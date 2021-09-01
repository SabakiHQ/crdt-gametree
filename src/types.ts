import type { Change } from "./Change.ts";
import type { FracPos } from "./fractionalPosition.ts";
import type { Timestamped, TimestampedValue } from "./timestamp.ts";

declare const idTag: unique symbol;

export type Id = string & { [idTag]?: true };

export type Currents = Map<Id, Id>;

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
  props?: Partial<Record<string, MetaNodeProperty>>;
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
  props(): Readonly<Partial<Record<string, [string, ...string[]]>>>;
}

export interface GameTreeJson {
  timestamp: number;
  metaNodes: Partial<Record<Id, MetaNode>>;
  queuedChanges: Partial<Record<Id, Change[]>>;
}
