import { compareLexically } from "./helper.ts";

export type FracPos = [...[number, string][], [number, string]];

export function compare(pos1: FracPos | null, pos2: FracPos | null): number {
  if (pos1 == null && pos1 == pos2) {
    return 0;
  } else if (pos1 == null) {
    return -1;
  } else if (pos2 == null) {
    return 1;
  }

  return compareLexically(compareLexically<number | string>())(pos1, pos2);
}

export function equals(pos1: FracPos | null, pos2: FracPos | null) {
  return compare(pos1, pos2) === 0;
}

export function create(
  author: string,
  before: FracPos | null,
  after: FracPos | null,
): FracPos {
  if (before == null && after == null) {
    return [[0, author]];
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
