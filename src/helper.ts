export type CompareFunction<T> = (x: T, y: T) => -1 | 0 | 1;

export function uuid(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function compare<T>(x: T, y: T): -1 | 0 | 1 {
  return x < y ? -1 : x > y ? 1 : 0;
}

export function compareMap<T, U>(
  fn: (value: T) => U,
  cmp: CompareFunction<U> = compare,
): CompareFunction<T> {
  return (x: T, y: T) => cmp(fn(x), fn(y));
}

export function compareLexically<T>(
  cmp: CompareFunction<T> = compare,
): CompareFunction<readonly T[]> {
  return (arr1, arr2) => {
    let inner = (i: number): -1 | 0 | 1 => {
      if (i >= arr1.length || i >= arr2.length) {
        return Math.sign(arr1.length - arr2.length) as -1 | 0 | 1;
      }

      let compare = cmp(arr1[i], arr2[i]);
      return compare !== 0 ? compare : inner(i + 1);
    };

    return inner(0);
  };
}

export function max<T>(
  cmp: CompareFunction<T> = compare,
): (...xs: readonly T[]) => T | null {
  return (x, ...rest) =>
    x == null ? null : rest.reduce((max, x) => (cmp(max, x) < 0 ? x : max), x);
}

export function min<T>(
  cmp: CompareFunction<T> = compare,
): (...xs: readonly T[]) => T | null {
  return max((x, y) => -cmp(x, y) as -1 | 0 | 1);
}
