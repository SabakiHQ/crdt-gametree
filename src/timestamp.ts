import { compareLexically } from "./helper.ts";

export interface Timestamped {
  author: string;
  timestamp: number;
}

export type TimestampedValue<T> = Timestamped & { value: T };

export function compareTimestamps(
  x: Readonly<Timestamped>,
  y: Readonly<Timestamped>,
): -1 | 0 | 1 {
  return compareLexically<string | number>()(
    [x.timestamp, x.author],
    [y.timestamp, y.author],
  );
}

export function extractTimestamp(x: Readonly<Timestamped>): number {
  return x.timestamp;
}

export function extractAuthorTimestamp(x: Readonly<Timestamped>): Timestamped {
  return {
    author: x.author,
    timestamp: x.timestamp,
  };
}

export function conditionallyAssign<T extends Timestamped>(
  base: T,
  obj: Readonly<Partial<T> & Timestamped>,
): void {
  if (compareTimestamps(base, obj) < 0) {
    Object.assign(base, obj);
  }
}
