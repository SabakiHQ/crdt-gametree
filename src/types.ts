import type { FracPos } from "./fractionalPosition.ts";
import { Enum } from "../deps.ts";

declare const idTag: unique symbol;

export type Id = string & { [idTag]?: true };

export type Currents = Map<Id, Id>;

export type Key = string | number;

export interface GameTreeOptions {
  author: string;
  timestamp?: number;
}

export interface Timestamped {
  author: string;
  timestamp: number;
}

export type TimestampedValue<T> = Timestamped & { value: T };

export interface MetaNode extends Timestamped {
  readonly id: Id;
  readonly level: number;
  readonly key?: Key;
  readonly parent?: Id;
  deleted?: TimestampedValue<boolean>;
  position: TimestampedValue<FracPos>;
  props?: Partial<Record<string, MetaNodePropertyValue[]>>;
  children?: Id[];
}

export interface MetaNodePropertyValue extends Timestamped {
  deleted?: TimestampedValue<boolean>;
  readonly value: string;
}

export interface Node extends Timestamped {
  readonly id: Id;
  readonly level: number;
  readonly key?: Key;
  readonly parent: Node | null;
  readonly isolated: () => boolean;
  readonly children: () => readonly Node[];
  readonly props: () => Readonly<Partial<Record<string, string[]>>>;
}

export interface GameTreeJson {
  timestamp: number;
  metaNodes: Partial<Record<Id, MetaNode>>;
}

const ChangeVariants = {
  AppendNode: 0 as unknown as Readonly<
    Timestamped & {
      id: Id;
      key?: Key;
      parent: Id;
      props?: Partial<Record<string, string[]>>;
    }
  >,
  DeleteNode: 0 as unknown as Readonly<
    Timestamped & {
      id: Id;
    }
  >,
  UndeleteNode: 0 as unknown as Readonly<
    Timestamped & {
      id: Id;
    }
  >,
};

export type Change = Enum<typeof ChangeVariants>;
export const Change = Enum.factory<Change>(ChangeVariants);
