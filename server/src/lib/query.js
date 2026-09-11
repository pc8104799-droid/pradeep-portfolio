import { badRequest } from './http-error.js';

/**
 * The shared read pipeline for every list endpoint: equality filters taken from
 * the query string, free-text search, sort, then a page. Keeping it in one place
 * is why `/appointments?status=confirmed&sort=-date&page=2` behaves exactly like
 * `/medicines?category=vitamins&sort=price`.
 *
 * Paging only kicks in when the caller asks for it, so internal callers can keep
 * treating these as plain arrays.
 */
export function listQuery(rows, query, options = {}) {
  const { searchable = [], filterable = [], defaultSort = null, maxLimit = 200 } = options;

  let result = rows;

  for (const field of filterable) {
    const raw = query[field];
    if (raw === undefined || raw === '' || raw === 'all') continue;

    const wanted = String(raw)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    result = result.filter((row) => {
      const value = pick(row, field);

      // Array columns (a doctor's languages, a medicine's tags) match if any
      // entry matches, which is what a multi-select filter means.
      if (Array.isArray(value)) {
        return value.some((entry) => wanted.includes(String(entry).toLowerCase()));
      }

      return wanted.includes(String(value ?? '').toLowerCase());
    });
  }

  const search = String(query.q ?? query.search ?? '').trim().toLowerCase();
  if (search && searchable.length) {
    result = result.filter((row) =>
      searchable.some((field) => String(pick(row, field) ?? '').toLowerCase().includes(search)),
    );
  }

  const sort = String(query.sort ?? defaultSort ?? '');
  if (sort) {
    const descending = sort.startsWith('-');
    const field = descending ? sort.slice(1) : sort;

    result = [...result].sort(
      (a, b) => compare(pick(a, field), pick(b, field)) * (descending ? -1 : 1),
    );
  }

  const total = result.length;
  const paged = query.limit !== undefined || query.page !== undefined;
  const limit = clampNumber(query.limit, 1, maxLimit) ?? (total || 1);
  const page = clampNumber(query.page, 1, Number.MAX_SAFE_INTEGER) ?? 1;
  const start = (page - 1) * limit;

  return {
    items: paged ? result.slice(start, start + limit) : result,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Reads `a.b.c` out of a row, so endpoints can filter and sort on nested fields. */
function pick(row, path) {
  return path.split('.').reduce((value, key) => (value == null ? value : value[key]), row);
}

function compare(a, b) {
  if (a === b) return 0;

  // Missing values sink to the bottom whichever way the sort runs.
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function clampNumber(raw, min, max) {
  if (raw === undefined || raw === '') return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) throw badRequest(`Expected a number, received "${raw}".`);

  return Math.min(Math.max(Math.trunc(value), min), max);
}
