/**
 * Human-readable domain identifiers.
 *
 * Hospital staff read these aloud and type them into search boxes, so every id
 * carries its own prefix: you can tell an appointment from a prescription
 * without looking at which column it came from. They double as the QR payload.
 */
const PREFIXES = {
  user: 'USR',
  patient: 'PT',
  family: 'FM',
  doctor: 'DR',
  department: 'DEP',
  branch: 'BR',
  appointment: 'AP',
  consultation: 'CN',
  prescription: 'RX',
  record: 'MR',
  report: 'RP',
  test: 'TR',
  medicine: 'MED',
  order: 'ORD',
  payment: 'PAY',
  transaction: 'TXN',
  notification: 'NT',
  address: 'ADR',
  leave: 'LV',
};

/** Sequence state, rebuilt whenever the store is loaded from disk. */
const counters = new Map();

/** Teaches the generator about ids already in the file so nothing collides. */
export function primeCounters(db) {
  counters.clear();

  for (const rows of Object.values(db)) {
    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      const id = row?.id;
      if (typeof id !== 'string') continue;

      const match = /^([A-Z]+)-(?:\d{8}-)?(\d+)$/.exec(id);
      if (!match) continue;

      const [, prefix, sequence] = match;
      counters.set(prefix, Math.max(counters.get(prefix) ?? 0, Number(sequence)));
    }
  }
}

/**
 * `PT-000042` for stable records, `AP-20260911-0042` for anything a user thinks
 * about by date.
 */
export function nextId(kind, { dated = false, date = new Date() } = {}) {
  const prefix = PREFIXES[kind] ?? kind.toUpperCase();
  const next = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, next);

  if (dated) {
    return `${prefix}-${ymd(date).replaceAll('-', '')}-${String(next).padStart(4, '0')}`;
  }

  return `${prefix}-${String(next).padStart(6, '0')}`;
}

/** `2026-09-11` in local time — the format every date field in the store uses. */
export function ymd(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Adds days to a `YYYY-MM-DD` string and returns the same format. */
export function addDays(date, days) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return ymd(next);
}
