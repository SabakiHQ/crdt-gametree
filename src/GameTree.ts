import { Enum } from "../deps.ts";
import {
  Change,
  extendWithAuthorTimestamp,
  TimestampedChange,
} from "./Change.ts";
import type {
  Currents,
  GameTreeOptions,
  GameTreeState,
  Id,
  MetaNode,
  MetaNodeProperty,
  MetaNodePropertyValue,
  MutateResult,
  Node,
  PartRecord,
} from "./types.ts";
import { compareMap, min } from "./helper.ts";
import { comparePositions, createPosition } from "./fractionalPosition.ts";
import {
  compareTimestamps,
  conditionallyAssign,
  extractAuthorTimestamp,
} from "./timestamp.ts";
import { Mutator } from "./Mutator.ts";

const rootId = "R" as Id;

/**
 * A conflict-free replicated game tree data type.
 */
export class GameTree {
  /**
   * The unique author id of the game tree.
   */
  author: string;

  private state: GameTreeState = {
    timestamp: 1,
    metaNodes: {},
    idAliases: {},
    queuedChanges: {},
  };

  constructor(options: Readonly<GameTreeOptions>) {
    this.author = options.author;
    this.state.timestamp = Math.max(options.timestamp ?? 1, 1);

    // Create root node

    this.state.metaNodes[rootId] = {
      id: rootId,
      author: this.author,
      timestamp: 0,
      level: 0,
      position: {
        author: rootId,
        timestamp: 0,
        value: createPosition(rootId, null, null),
      },
    };
  }

  /**
   * Advances the internal logical timestamp and returns a usable, unused
   * timestamp, or sets it to given timestamp.
   */
  tick(): number;
  tick(timetamp: number): void;
  tick(timestamp?: number): number | void {
    if (timestamp != null) {
      this.state.timestamp = Math.max(this.state.timestamp, timestamp);
      return;
    }

    return this.state.timestamp++;
  }

  /**
   * Iterates through all ancestors parent by parent of the node with the
   * given id.
   */
  *ancestors(id: Id): Generator<Id> {
    let metaNode = this.getMetaNode(id);

    while (metaNode != null && metaNode.parent != null) {
      metaNode = this.getMetaNode(metaNode.parent);
      if (metaNode == null || metaNode.deleted?.value === true) return;

      yield metaNode.id;
    }
  }

  /**
   * Iterates depth-first through all descendants of the node with the given id.
   */
  *descendants(id: Id): Generator<Id> {
    // Depth first iteration of descendants

    const stack = [id];

    while (stack.length > 0) {
      const stackId = stack.pop()!;
      const metaNode = this.getMetaNode(stackId);

      if (metaNode != null && !metaNode.deleted?.value) {
        if (stackId !== id) yield stackId;

        stack.push(...metaNode.children ?? []);
      }
    }
  }

  /**
   * Iterates through the current descendants of the node with the given id
   * along the given currents object.
   */
  *currentDescendants(id: Id, currents?: Readonly<Currents>): Generator<Id> {
    let metaNode = this.getMetaNode(id);

    while (
      metaNode != null &&
      metaNode.children != null &&
      metaNode.children.length > 0
    ) {
      const currentChildId = (() => {
        const currentChildId = currents?.[metaNode.id];
        const childrenMetaNodes = metaNode.children
          .map((id) => this.getMetaNode(id))
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

      metaNode = this.getMetaNode(currentChildId);
    }
  }

  /**
   * Returns the node id that is located a certain number of steps from the node
   * with the given id along the given currents object. If step is negative, we
   * move towards parent, otherwise towards current child.
   */
  navigate(id: Id, step: number, currents?: Readonly<Currents>): Id | null {
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

  /**
   * Determines whether the node with the given id is reachable from the root
   * node by following along the given currents object.
   */
  isCurrent(id: Id, currents?: Readonly<Currents>): boolean {
    const metaNode = this.getMetaNode(id);
    if (metaNode == null) return false;
    if (metaNode.level === 0) return true;

    const currentDescendantId = this.navigate(rootId, metaNode.level, currents);
    return currentDescendantId != null && currentDescendantId === id;
  }

  getMetaNode(id: Id): MetaNode | null {
    let metaNode = this.state.metaNodes[id];
    let idAlias: Id | undefined;

    if (metaNode == null && (idAlias = this.state.idAliases[id]) != null) {
      metaNode = this.state.metaNodes[idAlias];
    }

    return metaNode ?? null;
  }

  /**
   * Returns the node with the given id or `null` if there is no such node. We
   * do not check whether the node is still reachable from the root node, which
   * might be the case if an ancestor node has been deleted.
   */
  get(id: Id): Node | null {
    const metaNode = this.getMetaNode(id);
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
              (id) => self.getMetaNode(id)!.position.value,
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
          }, {} as PartRecord<string, string[]>);
      },
    } as Node & { _parent?: Node | null };
  }

  /**
   * Returns the root node.
   */
  getRoot(): Node {
    return this.get(rootId)!;
  }

  private applyQueuedChanges(id: Id): void {
    const queue = this.state.queuedChanges[id] ?? [];

    for (const change of queue) {
      this.applyChange(change);
    }

    delete this.state.queuedChanges[id];
  }

  private queueChange(id: Id, change: TimestampedChange): void {
    let queue = this.state.queuedChanges[id];

    if (queue == null) {
      queue = this.state.queuedChanges[id] = [];
    }

    queue.push(change);
  }

  /**
   * Applies the given remote change to the tree.
   */
  applyChange(change: TimestampedChange): this {
    this.tick(change.timestamp);

    const authorTimestamp = extractAuthorTimestamp(change);

    Enum.match(change.value, {
      AppendNode: (data) => {
        const parentMetaNode = this.getMetaNode(data.parent);
        const metaNode = this.getMetaNode(data.id);
        let mergingMetaNode: MetaNode | null;

        if (metaNode != null) {
          // Found node with same id already
          // Transform into an UpdateNode with an undelete operation instead

          return this.applyChange(
            extendWithAuthorTimestamp(
              Change.UpdateNode({
                id: data.id,
                deleted: false,
              }),
              authorTimestamp,
            ),
          );
        } else if (parentMetaNode == null) {
          // Parent node may not be created yet, queue change for later

          this.queueChange(data.parent, change);
        } else if (
          data.key != null &&
          (mergingMetaNode = parentMetaNode.children
              ?.map((id) => this.getMetaNode(id))
              .find(
                (siblingMetaNode) => siblingMetaNode?.key === data.key,
              ) ?? null) != null
        ) {
          // Found sibling node with same key, thus merging required

          conditionallyAssign(mergingMetaNode, {
            ...authorTimestamp,
            position: {
              ...authorTimestamp,
              value: data.position,
            },
          });

          this.state.idAliases[data.id] = mergingMetaNode.id;
          this.applyQueuedChanges(data.id);
        } else {
          // Add node

          this.state.metaNodes[data.id] = {
            ...authorTimestamp,
            id: data.id,
            key: data.key,
            parent: data.parent,
            level: parentMetaNode.level + 1,
            position: {
              ...authorTimestamp,
              value: data.position,
            },
          };

          this.applyQueuedChanges(data.id);
        }
      },
      UpdateNode: (data) => {
        const metaNode = this.getMetaNode(data.id);

        if (data.id === rootId) {
          // Ignore deletions/repositioning of root node
        } else if (metaNode == null) {
          // Node not created yet, queue change

          this.queueChange(data.id, change);
        } else {
          // Update node conditionally

          if (data.position != null) {
            conditionallyAssign(metaNode.position, {
              ...authorTimestamp,
              value: data.position,
            });
          }

          if (data.deleted != null) {
            const newDeleted = {
              ...authorTimestamp,
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
        const metaNode = this.getMetaNode(data.id);

        if (metaNode == null) {
          // Node not created yet, queue change

          this.queueChange(data.id, change);
        } else {
          // Update property value conditionally

          if (metaNode.props == null) metaNode.props = {};

          const metaProp = metaNode.props[data.prop];
          const newMetaPropValue: MetaNodePropertyValue = {
            ...authorTimestamp,
            value: data.value,
            deleted: data.deleted,
          };

          if (metaProp == null) {
            // No property values yet

            metaNode.props[data.prop] = {
              ...authorTimestamp,
              values: [newMetaPropValue],
            };
          } else if (compareTimestamps(metaProp, change) < 0) {
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
        const metaNode = this.getMetaNode(data.id);

        if (metaNode == null) {
          // Node not created yet, queue change

          this.queueChange(data.id, change);
        } else {
          // Update property conditionally

          if (metaNode.props == null) metaNode.props = {};

          const metaProp = metaNode.props[data.prop];
          const retainingMetaPropValues = metaProp?.values
            .filter((metaPropValue) =>
              compareTimestamps(change, metaPropValue) < 0
            ) ?? [];

          const newMetaProp: MetaNodeProperty = {
            ...authorTimestamp,
            values: data.values.map((value) => ({
              ...authorTimestamp,
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

  /**
   * Use this method to apply any local changes to the tree.
   */
  mutate(fn: (mutator: Mutator) => void): MutateResult {
    const mutator = new Mutator(this);

    fn(mutator);

    return mutator.result;
  }

  /**
   * Create a new `GameTree` instances using the given JSON object that
   * represents the game tree state.
   */
  static fromJSON(
    data: GameTreeState,
    options: Readonly<GameTreeOptions>,
  ): GameTree {
    const tree = new GameTree(options);
    tree.state = data

    return tree;
  }

  /**
   * Returns a serializable JSON object that represents and changes with the
   * game tree state.
   */
  toJSON(): GameTreeState {
    return this.state;
  }
}
