/**
 * Dotted-path helpers used by the generic editors. Field keys in the schema can
 * point inside an item (`keyProject.title`) or at an array slot (`accent.0`), so
 * reads and writes go through these instead of direct property access.
 */

type Bag = Record<string, unknown>;

export function getPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, segment) => (value == null ? undefined : (value as Bag)[segment]),
      source,
    );
}

/**
 * Returns a copy of `source` with `path` set to `value`. Missing intermediate
 * levels are created — an object, or an array when the next segment is numeric.
 */
export function setPath<T>(source: T, path: string, value: unknown): T {
  const segments = path.split('.');
  const root: unknown = Array.isArray(source) ? [...source] : { ...(source as Bag) };
  let cursor = root;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const existing = (cursor as Bag)[segment];
    const nextIsIndex = /^\d+$/.test(segments[i + 1]);

    const branch = Array.isArray(existing)
      ? [...existing]
      : existing && typeof existing === 'object'
        ? { ...(existing as Bag) }
        : nextIsIndex
          ? []
          : {};

    (cursor as Bag)[segment] = branch;
    cursor = branch;
  }

  (cursor as Bag)[segments[segments.length - 1]] = value;
  return root as T;
}
