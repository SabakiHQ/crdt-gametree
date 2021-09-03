import type { Change, TimestampedChange } from "./Change.ts";
import type { FracPos } from "./fractionalPosition.ts";
import type { Timestamped, TimestampedValue } from "./timestamp.ts";

declare const idTag: unique symbol;

export type PartRecord<T extends string | number | symbol, U> = Partial<
  Record<T, U>
>;

export type Id = string & { [idTag]: true };

export type Currents = PartRecord<string, Id>;

export type Key = string | number;

export type CompareFunction<T> = (x: T, y: T) => -1 | 0 | 1;

export interface GameTreeOptions {
  /**
   * The unique author id of the game tree.
   */
  author: string;
  /**
   * Override the logical timestamp with this option.
   */
  timestamp?: number;
}

export interface MetaNode extends Timestamped {
  readonly id: Id;
  readonly level: number;
  readonly key?: Key;
  readonly parent?: Id;
  deleted?: TimestampedValue<boolean>;
  position: TimestampedValue<FracPos>;
  props?: PartRecord<string, MetaNodeProperty>;
  children?: Id[];
}

export interface MetaNodeProperty extends Timestamped {
  values: MetaNodePropertyValue[];
}

export interface MetaNodePropertyValue extends Timestamped {
  deleted?: boolean;
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
   * The parent node or `null` if there is no parent.
   */
  readonly parent: Node | null;
  /**
   * Determines whether the node is reachable from the root node. If this
   * returns `true`, the node has a deleted ancestor.
   */
  isolated(): boolean;
  /**
   * Returns all child nodes of the node.
   */
  children(): readonly Node[];
  /**
   * Returns a map of all properties and their values of the node.
   */
  props(): Readonly<PartRecord<string, readonly [string, ...string[]]>>;
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

export interface GameTreeState {
  timestamp: number;
  rootId: TimestampedValue<Id>;
  metaNodes: PartRecord<string, MetaNode>;
  idAliases: PartRecord<string, Id>;
  queuedChanges: PartRecord<string, TimestampedChange[]>;
}
