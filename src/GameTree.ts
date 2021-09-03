import { Enum } from "../deps.ts";
import {
  Change,
  extendChangeWithTimestamp,
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

const defaultRootId = "R" as Id;

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
    rootId: {
      author: defaultRootId,
      timestamp: 0,
      value: defaultRootId,
    },
    metaNodes: {},
    idAliases: {},
    queuedChanges: {},
  };

  constructor(options: Readonly<GameTreeOptions>) {
    this.author = options.author;
    this.state.timestamp = Math.max(options.timestamp ?? 1, 1);

    // Create root node

    this.state.metaNodes[defaultRootId] = {
      id: defaultRootId,
      author: this.author,
      timestamp: 0,
      level: 0,
      position: {
        author: defaultRootId,
        timestamp: 0,
        value: createPosition(defaultRootId, null, null),
      },
    };
  }

  get rootId(): Id {
    return this.state.rootId.value;
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
   * Determines whether the two given ids point to the same node or not.
   */
  equalsId(x: Id, y: Id): boolean {
    return x === y ||
      this.state.idAliases[x] === y ||
      this.state.idAliases[y] === x;
  }

  /**
   * Returns the underlying meta information of the given node id.
   */
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
    const rootMetaNode = this.getMetaNode(this.rootId)!;

    if (metaNode == null) return null;
    if (metaNode !== rootMetaNode && !!metaNode.deleted?.value) {
      // Root node cannot be considered deleted
      return null;
    }
    if (
      metaNode !== rootMetaNode &&
      metaNode.level <= rootMetaNode.level
    ) {
      // Impossible to be a descendant of current root node
      return null;
    }

    const self = this;

    return {
      id: metaNode.id,
      key: metaNode.key,
      author: metaNode.author,
      timestamp: metaNode.timestamp,

      get level() {
        return metaNode!.level - self.getMetaNode(self.rootId)!.level;
      },

      get parent() {
        if (this._parent === undefined) {
          return this._parent =
            metaNode?.parent == null || self.equalsId(id, self.rootId)
              ? null
              : self.get(metaNode.parent);
        }

        return this._parent;
      },

      isolated() {
        if (self.equalsId(id, self.rootId)) return false;

        // Find whether there is a deleted ancestor

        for (const ancestor of self.ancestors(id)) {
          if (self.equalsId(ancestor.id, self.rootId)) return false;
        }

        return true;
      },

      children() {
        return (metaNode?.children ?? [])
          .map((id) => self.get(id))
          .filter((node): node is Node => node != null)
          .sort(
            compareMap(
              (node) => self.getMetaNode(node.id)!.position.value,
              comparePositions,
            ),
          );
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
    return this.get(this.rootId)!;
  }

  /**
   * Iterates through all ancestors parent by parent of the node with the
   * given id.
   */
  *ancestors(id: Id): Generator<Node> {
    let node = this.get(id);

    while (node != null && node.parent != null) {
      node = node.parent;
      if (node == null) return;

      yield node;
    }
  }

  /**
   * Iterates depth-first through all descendants of the node with the given id.
   */
  *descendants(id: Id): Generator<Node> {
    const node = this.get(id);
    if (node == null) return;

    // Depth first iteration of descendants

    const stack = [node];

    while (stack.length > 0) {
      const stackNode = stack.pop()!;

      if (stackNode != null) {
        if (stackNode.id !== id) yield stackNode;

        stack.push(...stackNode.children() ?? []);
      }
    }
  }

  /**
   * Iterates through the current descendants of the node with the given id
   * along the given currents object.
   */
  *currentDescendants(id: Id, currents?: Readonly<Currents>): Generator<Node> {
    let node = this.get(id);

    while (node != null) {
      const children = node.children();
      if (children.length === 0) break;

      const currentChild = (() => {
        const currentChildId = currents?.[node.id];
        let currentChild: Node | undefined;

        if (
          currentChildId != null &&
          (currentChild = children
              .find((child) => this.equalsId(child.id, currentChildId))) != null
        ) {
          return currentChild;
        }

        // If no current child is given, use left most child node

        return children[0];
      })();

      yield currentChild;

      node = currentChild;
    }
  }

  /**
   * Returns the node that is located a certain number of steps from the node
   * with the given id along the given currents object. If step is negative, we
   * move towards parent, otherwise towards current child.
   */
  navigate(id: Id, step: number, currents?: Readonly<Currents>): Node | null {
    if (step === 0) return this.get(id);

    let lastResult: Node | null = null;

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
    const node = this.get(id);
    if (node == null) return false;

    const currentDescendant = this.navigate(
      this.rootId,
      node.level,
      currents,
    );

    return currentDescendant != null && this.equalsId(currentDescendant.id, id);
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
        let mergingMetaNode: MetaNode | undefined;

        if (metaNode != null) {
          // Found node with same id already
          // Transform into an UpdateNode with an undelete operation instead

          return this.applyChange(
            extendChangeWithTimestamp(
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
              ) ?? undefined) != null
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

        if (metaNode == null) {
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
      UpdateRoot: (data) => {
        const metaNode = this.getMetaNode(data.id);

        if (metaNode == null) {
          // Node not created yet, queue change

          this.queueChange(data.id, change);
        } else {
          // Update root conditionally

          conditionallyAssign(this.state.rootId, {
            ...authorTimestamp,
            value: data.id,
          });
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
    tree.state = data;

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
