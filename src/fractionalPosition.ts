import { compareLexically } from "./helper.ts";
import type { CompareFunction } from "./types.ts";

export type FracPos = readonly [
  ...(readonly [number, string])[],
  readonly [number, string],
];

export const comparePositions = compareLexically(
  compareLexically<number | string>(),
) as CompareFunction<FracPos>;

export function equalsPositions(pos1: FracPos | null, pos2: FracPos | null) {
  if (pos1 == null && pos1 == pos2) return true;
  if (pos1 == null || pos2 == null) return false;
  return comparePositions(pos1, pos2) === 0;
}

export function createPosition(
  author: string,
  before: FracPos | null,
  after: FracPos | null,
): FracPos {
  if (before == null && after == null) {
    return [[0, author]];
  } else if (equalsPositions(before, after)) {
    throw new Error("Impossible position, as before is equals to after");
  } else if (
    before != null && after != null && comparePositions(before, after) > 0
  ) {
    throw new Error("Impossible position, as before is greater than after");
  }

  if (
    before != null &&
    after != null &&
    before.length === after.length &&
    after[after.length - 1][0] - before[before.length - 1][0] <= 1
  ) {
    return [...before, [0, author]];
  }

  let anchorId = after == null
    ? before!
    : before == null
    ? after!
    : before.length > after.length
    ? before
    : before.length < after.length
    ? after
    : before;

  let [lastFragment] = anchorId.slice(-1);
  let diff = anchorId === before ? 1 : -1;

  return [...anchorId.slice(0, -1), [lastFragment[0] + diff, author]];
}
