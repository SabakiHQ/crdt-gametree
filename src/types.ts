import type { Change, TimestampedChange } from "./Change.ts";
import type { FracPos } from "./fractionalPosition.ts";
import type { Timestamped, TimestampedValue } from "./timestamp.ts";

export type PartRecord<T extends string | number | symbol, U> = Partial<
  Record<T, U>
>;

interface IdTag {}

/**
 * Represents a node id.
 */
export type Id = string & IdTag;

/**
 * Any node can have a current child. With a `Currents` object you can specify
 * current child of nodes.
 */
export type Currents = PartRecord<string, Id>;

/**
 * Represents a node key
 */
export type Key = string | number;

export type CompareFunction<T> = (x: T, y: T) => -1 | 0 | 1;

/**
 * Represents the serializable game tree state.
 */
export interface GameTreeState {
  timestamp: number;
  rootId: TimestampedValue<Id>;
  metaNodes: PartRecord<string, MetaNode>;
  idAliases: PartRecord<string, Id>;
  queuedChanges: PartRecord<string, TimestampedChange[]>;
}

export interface GameTreeOptions {
  /**
   * The unique author id of the game tree.
   */
  author: string;
  /**
   * Set the game tree state with this option.
   */
  state?: GameTreeState;
}

/**
 * Represents meta information of a node.
 */
export interface MetaNode extends Timestamped {
  /**
   * The node id.
   */
  readonly id: Id;
  /**
   * Indicates on which meta level the node is located. The initial root node
   * has level `0`, while every child node is one level bigger than its parent.
   */
  readonly level: number;
  /**
   * The node key.
   */
  readonly key?: Key;
  /**
   * The potential parent node id if exists.
   */
  readonly parent?: Id;
  /**
   * Indicates whether the node has been deleted or not.
   */
  deleted?: TimestampedValue<boolean>;
  /**
   * The fractional position of the node among its siblings.
   */
  position: TimestampedValue<FracPos>;
  /**
   * A map of all node props and their values ever added.
   */
  props?: PartRecord<string, MetaNodeProperty>;
  /**
   * An array of all child node ids ever added to the node.
   */
  children?: Id[];
}

/**
 * Represents meta information of a node property.
 */
export interface MetaNodeProperty extends Timestamped {
  /**
   * An array of all values ever added to the property.
   */
  values: MetaNodePropertyValue[];
}

/**
 * Represents meta information of a node property value.
 */
export interface MetaNodePropertyValue extends Timestamped {
  /**
   * Indicates whether the property value has been deleted or not.
   */
  deleted?: boolean;
  /**
   * The value.
   */
  readonly value: string;
}

/**
 * Represents a node.
 */
export interface Node extends Timestamped {
  /**
   * The node id.
   */
  readonly id: Id;
  /**
   * Indicates on which level the node is located. The root node has level `0`,
   * while every child node is one level bigger than its parent.
   */
  readonly level: number;
  /**
   * The node key.
   */
  readonly key?: Key;
  /**
   * The parent node if exists.
   */
  readonly parent?: Node;
  /**
   * Determines whether the node is reachable from the root node. If this
   * returns `true`, the node has a deleted ancestor.
   */
  isolated(): boolean;
  /**
   * Returns the values of the given prop.
   */
  prop(name: string): string[];
  /**
   * Returns a map of all properties and their values of the node.
   */
  props(): PartRecord<string, [string, ...string[]]>;
  /**
   * Returns all child nodes of the node.
   */
  children(): Node[];
}

/**
 * A serializable JSON object that represents a node.
 */
export interface JsonNode {
  /**
   * The node id.
   */
  id: Id;
  /**
   * The parent node id if exists
   */
  parent?: Id;
  /**
   * Indicates on which level the node is located. The root node has level `0`,
   * while every child node is one level bigger than its parent.
   */
  level: number;
  /**
   * The node key.
   */
  key?: Key;
  /**
   * A map of all properties and their values of the node.
   */
  props: PartRecord<string, [string, ...string[]]>;
  /**
   * An array of all child nodes.
   */
  children: JsonNode[];
}

export interface MutateResult {
  /**
   * The local changes that were applied.
   */
  changes: TimestampedChange[];
  /**
   * An array of corresponding changes that can be applied to undo the
   * changes made.
   */
  inverseChanges: Change[];
}
