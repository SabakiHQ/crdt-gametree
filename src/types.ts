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

export interface GameTreeOptions {
  author: string;
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

export interface Node extends Timestamped {
  readonly id: Id;
  readonly level: number;
  readonly key?: Key;
  readonly parent: Node | null;
  isolated(): boolean;
  children(): readonly Node[];
  props(): Readonly<PartRecord<string, readonly [string, ...string[]]>>;
}

export interface MutateResult {
  changes: TimestampedChange[];
  inverseChanges: Change[];
}

export interface GameTreeJson {
  timestamp: number;
  metaNodes: Readonly<PartRecord<string, MetaNode>>;
  queuedChanges: Readonly<PartRecord<string, TimestampedChange[]>>;
}
