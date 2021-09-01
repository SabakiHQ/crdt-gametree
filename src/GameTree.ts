import { Enum } from "../deps.ts";
import { Change } from "./Change.ts";
import type {
  Currents,
  GameTreeJson,
  GameTreeOptions,
  Id,
  MetaNode,
  MetaNodeProperty,
  MetaNodePropertyValue,
  Node,
} from "./types.ts";
import { compareMap, min } from "./helper.ts";
import { comparePositions, createPosition } from "./fractionalPosition.ts";
import {
  compareTimestamps,
  conditionallyAssign,
  extractTimestamp,
} from "./timestamp.ts";

const rootId: Id = "R";

export class GameTree {
  author: string;
  private timestamp: number;
  private metaNodes: Map<Id, MetaNode> = new Map();
  private queuedChanges: Map<Id, Change[]> = new Map();

  constructor(options: Readonly<GameTreeOptions>) {
    this.author = options.author;
    this.timestamp = Math.max(options.timestamp ?? 1, 1);

    // Create root node

    this.metaNodes.set(rootId, {
      id: rootId,
      author: this.author,
      timestamp: 0,
      level: 0,
      position: {
        author: rootId,
        timestamp: 0,
        value: createPosition(rootId, null, null),
      },
    });
  }

  tick(): number {
    return this.timestamp++;
  }

  *ancestors(id: Id): Generator<Id> {
    let metaNode = this.metaNodes.get(id);

    while (metaNode != null && metaNode.parent != null) {
      metaNode = this.metaNodes.get(metaNode.parent);
      if (metaNode == null || metaNode.deleted?.value === true) return;

      yield metaNode.id;
    }
  }

  *descendants(id: Id): Generator<Id> {
    // Depth first iteration of descendants

    const stack = [id];

    while (stack.length > 0) {
      const stackId = stack.pop()!;
      const metaNode = this.metaNodes.get(stackId);

      if (metaNode != null && !metaNode.deleted?.value) {
        if (stackId !== id) yield stackId;

        stack.push(...metaNode.children ?? []);
      }
    }
  }

  *currentDescendants(id: Id, currents?: Currents): Generator<Id> {
    let metaNode = this.metaNodes.get(id);

    while (
      metaNode != null &&
      metaNode.children != null &&
      metaNode.children.length > 0
    ) {
      const currentChildId = (() => {
        const currentChildId = currents?.get(metaNode.id);
        const childrenMetaNodes = metaNode.children
          .map((id) => this.metaNodes.get(id))
          .filter((metaNode): metaNode is MetaNode =>
            metaNode != null && !metaNode.deleted?.value
          );

        if (
          currentChildId != null &&
          childrenMetaNodes.some((childMetaNode) =>
            childMetaNode.id === currentChildId
          )
        ) {
          return currentChildId;
        }

        // If no current child is given, use left most child node

        return min(
          compareMap(
            (metaNode: MetaNode) => metaNode.position.value,
            comparePositions,
          ),
        )(...childrenMetaNodes)?.id;
      })();

      if (currentChildId == null) break;
      yield currentChildId;

      metaNode = this.metaNodes.get(currentChildId);
    }
  }

  navigate(id: Id, step: number, currents?: Currents): Id | null {
    if (step === 0) return id;

    let lastResult: Id | null = null;

    if (step < 0) {
      for (const result of this.ancestors(id)) {
        lastResult = result;
        step++;
        if (step === 0) return result;
      }
    } else if (step > 0) {
      for (const result of this.currentDescendants(id, currents)) {
        lastResult = result;
        step--;
        if (step === 0) return result;
      }
    }

    return lastResult;
  }

  onCurrentLine(id: Id, currents?: Currents): boolean {
    const metaNode = this.metaNodes.get(id);
    if (metaNode == null) return false;
    if (metaNode.level === 0) return true;

    const currentDescendantId = this.navigate(rootId, metaNode.level, currents);
    return currentDescendantId != null && currentDescendantId === id;
  }

  get(id: Id): Node | null {
    const metaNode = this.metaNodes.get(id);
    if (metaNode == null || metaNode.deleted?.value === true) return null;

    const self = this;

    return {
      id: metaNode.id,
      key: metaNode.key,
      author: metaNode.author,
      timestamp: metaNode.timestamp,
      level: metaNode.level,

      get parent() {
        if (this._parent === undefined) {
          return this._parent = metaNode?.parent == null
            ? null
            : self.get(metaNode.parent);
        }

        return this._parent;
      },

      isolated() {
        if (id === rootId) return false;

        // Find whether there is a deleted ancestor

        for (const ancestorId of self.ancestors(id)) {
          if (ancestorId === rootId) return false;
        }

        return true;
      },

      children() {
        return (metaNode?.children ?? [])
          .sort(
            compareMap(
              (id) => self.metaNodes.get(id)!.position.value,
              comparePositions,
            ),
          )
          .map((id) => self.get(id))
          .filter((node): node is Node => node != null);
      },

      props() {
        return Object.entries(metaNode?.props ?? {})
          .reduce((props, [name, metaProp]) => {
            const values = metaProp?.values
              ?.filter((metaPropValue) => !metaPropValue.deleted)
              .map((metaPropValue) => metaPropValue.value);

            if (values != null && values.length > 0) {
              props[name] = values;
            }

            return props;
          }, {} as Partial<Record<string, string[]>>);
      },
    } as Node & { _parent?: Node | null };
  }

  getRoot(): Node {
    return this.get(rootId)!;
  }

  private applyQueuedChanges(id: Id): void {
    const queue = this.queuedChanges.get(id) ?? [];

    for (const change of queue) {
      this.applyChange(change);
    }

    this.queuedChanges.delete(id);
  }

  private queueChange(id: Id, change: Change): void {
    if (!this.queuedChanges.has(id)) {
      this.queuedChanges.set(id, []);
    }

    this.queuedChanges.get(id)!.push(change);
  }

  applyChange(change: Change): this {
    Enum.match(change, {
      AppendNode: (data) => {
        const timestamp = extractTimestamp(data);
        const parentMetaNode = this.metaNodes.get(data.parent);
        const metaNode = this.metaNodes.get(data.id);
        let mergingMetaNode: MetaNode | undefined;

        if (metaNode != null) {
          // Found node with same id already
          // Transform into an UpdateNode with an undelete operation instead

          return this.applyChange(Change.UpdateNode({
            ...timestamp,
            id: data.id,
            deleted: false,
          }));
        } else if (parentMetaNode == null) {
          // Parent node may not be created yet, queue change for later

          this.queueChange(data.parent, change);
        } else if (
          data.key != null &&
          (mergingMetaNode = parentMetaNode.children
              ?.map((id) => this.metaNodes.get(id))
              .find(
                (siblingMetaNode) => siblingMetaNode?.key === data.key,
              )) != null
        ) {
          // Found sibling node with same key, thus merging required

          conditionallyAssign(mergingMetaNode, {
            ...timestamp,
            position: {
              ...timestamp,
              value: data.position,
            },
          });

          this.metaNodes.set(data.id, mergingMetaNode);
          this.applyQueuedChanges(data.id);
        } else {
          // Add node

          this.metaNodes.set(data.id, {
            ...timestamp,
            id: data.id,
            key: data.key,
            parent: data.parent,
            level: parentMetaNode.level + 1,
            position: {
              ...timestamp,
              value: data.position,
            },
          });

          this.applyQueuedChanges(data.id);
        }
      },
      UpdateNode: (data) => {
        const metaNode = this.metaNodes.get(data.id);

        if (metaNode == null) {
          // Node not created yet, queue change

          this.queueChange(data.id, change);
        } else {
          // Update node conditionally

          const timestamp = extractTimestamp(data);

          if (data.position != null) {
            conditionallyAssign(metaNode.position, {
              ...timestamp,
              value: data.position,
            });
          }

          if (data.deleted != null) {
            const newDeleted = {
              ...timestamp,
              value: data.deleted,
            };

            if (metaNode.deleted == null) {
              metaNode.deleted = newDeleted;
            } else {
              conditionallyAssign(metaNode.deleted, newDeleted);
            }
          }
        }
      },
      UpdatePropertyValue: (data) => {
        const metaNode = this.metaNodes.get(data.id);

        if (metaNode == null) {
          // Node not created yet, queue change

          this.queueChange(data.id, change);
        } else {
          // Update property value conditionally

          if (metaNode.props == null) metaNode.props = {};

          const timestamp = extractTimestamp(data);
          const metaProp = metaNode.props[data.prop];
          const newMetaPropValue: MetaNodePropertyValue = {
            ...timestamp,
            value: data.value,
            deleted: data.deleted,
          };

          if (metaProp == null) {
            // No property values yet

            metaNode.props[data.prop] = {
              ...timestamp,
              values: [newMetaPropValue],
            };
          } else if (compareTimestamps(metaProp, data) < 0) {
            // We are allowed to apply our update

            const metaPropValue = metaProp.values
              .find((metaPropValue) => metaPropValue.value === data.value);

            if (metaPropValue == null) {
              metaProp.values.push(newMetaPropValue);
            } else {
              conditionallyAssign(metaPropValue, newMetaPropValue);
            }
          }
        }
      },
      UpdateProperty: (data) => {
        const metaNode = this.metaNodes.get(data.id);

        if (metaNode == null) {
          // Node not created yet, queue change

          this.queueChange(data.id, change);
        } else {
          // Update property conditionally

          if (metaNode.props == null) metaNode.props = {};

          const timestamp = extractTimestamp(data);
          const metaProp = metaNode.props[data.prop];
          const retainingMetaPropValues = metaProp?.values
            .filter((metaPropValue) =>
              compareTimestamps(data, metaPropValue) < 0
            ) ?? [];

          const newMetaProp: MetaNodeProperty = {
            ...timestamp,
            values: data.values.map((value) => ({
              ...timestamp,
              value,
            })),
          };

          newMetaProp.values.push(...retainingMetaPropValues);

          if (metaProp == null) {
            metaNode.props[data.prop] = newMetaProp;
          } else {
            conditionallyAssign(metaProp, newMetaProp);
          }
        }
      },
      _: () => {
        // Unknown change variant, just ignore
      },
    });

    return this;
  }

  static fromJSON(
    data: GameTreeJson,
    options: Readonly<GameTreeOptions>,
  ): GameTree {
    const result = new GameTree({
      ...options,
      timestamp: data.timestamp,
    });

    result.metaNodes = new Map(Object.entries(data.metaNodes));
    result.queuedChanges = new Map(Object.entries(data.queuedChanges));

    return result;
  }

  toJSON(): GameTreeJson {
    return {
      timestamp: this.timestamp,
      metaNodes: Object.fromEntries(this.metaNodes),
      queuedChanges: Object.fromEntries(this.queuedChanges),
    };
  }
}
