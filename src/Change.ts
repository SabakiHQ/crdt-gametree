import { Enum, ofType } from "../deps.ts";
import type { FracPos } from "./fractionalPosition.ts";
import { Timestamped, TimestampedValue } from "./timestamp.ts";
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
  UpdateRoot: ofType<
    Readonly<{
      id: Id;
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
      values: readonly string[];
    }>
  >(),
};

/**
 * Represents a change that can be applied locally, but is not yet.
 */
export type Change = Enum<typeof ChangeVariants>;
export const Change = Enum.factory<Change>(ChangeVariants);

/**
 * Represents a change that has been applied locally or remotely.
 */
export type TimestampedChange = Readonly<TimestampedValue<Change>>;

/**
 * Elevates the given `Change` to a `TimestampedChange` using the
 * given `Timestamped`.
 */
export function extendChangeWithTimestamp(
  change: Change,
  authorTimestamp: Timestamped,
): TimestampedChange {
  return {
    ...authorTimestamp,
    value: change,
  };
}
