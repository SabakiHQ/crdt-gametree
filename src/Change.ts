import { Enum, ofType } from "../deps.ts";
import type { FracPos } from "./fractionalPosition.ts";
import type { Timestamped } from "./timestamp.ts";
import type { Id, Key } from "./types.ts";

type AppendNode = {
  id: Id;
  key?: Key;
  parent: Id;
  position: FracPos;
};

type UpdateNode = {
  id: Id;
  deleted?: boolean;
  position?: FracPos;
};

type UpdatePropertyValue = {
  id: Id;
  prop: string;
  value: string;
  deleted: boolean;
};

type UpdateProperty = {
  id: Id;
  prop: string;
  values: string[];
};

const ChangeVariants = {
  AppendNode: ofType<Readonly<AppendNode>>(),
  UpdateNode: ofType<Readonly<UpdateNode>>(),
  UpdatePropertyValue: ofType<Readonly<UpdatePropertyValue>>(),
  UpdateProperty: ofType<Readonly<UpdateProperty>>(),
};

type TimestampedChangeVariants = {
  [K in keyof typeof ChangeVariants]:
    & Readonly<Timestamped>
    & typeof ChangeVariants[K];
};

export type Change = Enum<typeof ChangeVariants>;
export const Change = Enum.factory<Change>(ChangeVariants);

export type TimestampedChange = Enum<TimestampedChangeVariants>;
export const TimestampedChange = Enum.factory<TimestampedChange>(
  ChangeVariants,
);
