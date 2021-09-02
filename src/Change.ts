import { Enum, ofType } from "../deps.ts";
import type { FracPos } from "./fractionalPosition.ts";
import type { Timestamped } from "./timestamp.ts";
import type { Id, Key } from "./types.ts";

const ChangeVariants = {
  AppendNode: ofType<
    Readonly<{
      id: Id;
      key?: Key;
      parent: Id;
      position: FracPos;
    }>
  >(),
  UpdateNode: ofType<
    Readonly<{
      id: Id;
      deleted?: boolean;
      position?: FracPos;
    }>
  >(),
  UpdatePropertyValue: ofType<
    Readonly<{
      id: Id;
      prop: string;
      value: string;
      deleted: boolean;
    }>
  >(),
  UpdateProperty: ofType<
    Readonly<{
      id: Id;
      prop: string;
      values: string[];
    }>
  >(),
};

type TimestampedChangeVariants = {
  [K in keyof typeof ChangeVariants]:
    & Readonly<Timestamped>
    & typeof ChangeVariants[K];
};

/**
 * Represents a change that can be applied locally, but is not yet.
 */
export type Change = Enum<typeof ChangeVariants>;
export const Change = Enum.factory<Change>(ChangeVariants);

/**
 * Represents a change that has been applied locally or remotely.
 */
export type TimestampedChange = Enum<TimestampedChangeVariants>;
export const TimestampedChange = Enum.factory<TimestampedChange>(
  ChangeVariants,
);

export function extendWithAuthorTimestamp(
  change: Change,
  authorTimestamp: Timestamped,
): TimestampedChange {
  for (const key in change) {
    const variant = key as keyof Change & string;

    if (change[variant] != null) {
      return {
        [variant]: { ...authorTimestamp, ...change[variant] },
      } as unknown as TimestampedChange;
    }
  }

  return change as TimestampedChange;
}
