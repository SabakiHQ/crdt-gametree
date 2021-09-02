import { compareLexically, compareMap } from "./helper.ts";

export interface Timestamped {
  author: string;
  timestamp: number;
}

export type TimestampedValue<T> = Timestamped & { value: T };

export const compareTimestamps = compareMap(
  (x: Readonly<Timestamped>) => [x.timestamp, x.author],
  compareLexically<string | number>(),
);

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
