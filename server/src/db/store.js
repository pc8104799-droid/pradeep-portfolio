import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from '../config.js';
import { notFound } from '../lib/http-error.js';
import { primeCounters } from '../lib/ids.js';
import { buildSeed } from './seed.js';

/**
 * The document store behind the whole API.
 *
 * `db.json` is read once into memory and every request works against that copy,
 * so reads are synchronous and route handlers stay easy to follow. Writes are
 * coalesced and flushed to disk through a temp file plus a rename, which means a
 * crash mid-write leaves the previous file intact rather than a half-written one.
 *
 * This is the seam a real deployment replaces: swap this class for a database
 * client and the routes above it do not change.
 */
class Store {
  #db = {};
  #flushTimer = null;
  #flushing = Promise.resolve();

  /** Loads the file, seeding a fresh one the first time the server runs. */
  async init() {
    try {
      const raw = await readFile(config.dbFile, 'utf8');
      this.#db = JSON.parse(raw);
      primeCounters(this.#db);
      return { seeded: false };
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;

      this.#db = await buildSeed();
      primeCounters(this.#db);
      await this.flush();
      return { seeded: true, reason: error.code === 'ENOENT' ? 'missing' : 'unreadable' };
    }
  }

  /** Replaces the store with freshly generated demo data. */
  async reseed() {
    this.#db = await buildSeed();
    primeCounters(this.#db);
    await this.flush();
  }

  /** The live array for a collection. Mutating it must be paired with `commit()`. */
  collection(name) {
    if (!Array.isArray(this.#db[name])) this.#db[name] = [];
    return this.#db[name];
  }

  /** Every collection name, for the health endpoint. */
  summary() {
    return Object.fromEntries(
      Object.entries(this.#db).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 1]),
    );
  }

  find(name, id) {
    return this.collection(name).find((row) => row.id === id) ?? null;
  }

  /** Same as `find`, but a missing row is a 404 instead of a null to check. */
  findOrFail(name, id, message) {
    const row = this.find(name, id);
    if (!row) throw notFound(message ?? `No ${singular(name)} matches "${id}".`);
    return row;
  }

  findBy(name, predicate) {
    return this.collection(name).find(predicate) ?? null;
  }

  filter(name, predicate) {
    return this.collection(name).filter(predicate);
  }

  insert(name, row) {
    this.collection(name).push(row);
    this.commit();
    return row;
  }

  /** Shallow-merges a patch into a row and returns the updated row. */
  update(name, id, patch) {
    const rows = this.collection(name);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) throw notFound(`No ${singular(name)} matches "${id}".`);

    rows[index] = { ...rows[index], ...patch, id, updatedAt: new Date().toISOString() };
    this.commit();
    return rows[index];
  }

  remove(name, id) {
    const rows = this.collection(name);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) throw notFound(`No ${singular(name)} matches "${id}".`);

    const [removed] = rows.splice(index, 1);
    this.commit();
    return removed;
  }

  /**
   * Marks the store dirty. Several writes inside one request collapse into a
   * single disk write on the next tick, so a booking that touches an
   * appointment, a payment and two notifications still only writes once.
   */
  commit() {
    if (this.#flushTimer) return;
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = null;
      this.#flushing = this.#flushing.then(() => this.flush()).catch((error) => {
        console.error('[db] failed to persist:', error.message);
      });
    }, 25);

    // Never hold the process open just to flush; the timer is best effort.
    this.#flushTimer.unref?.();
  }

  /** Writes the store to disk now. Awaited on boot and by the seed script. */
  async flush() {
    const temp = `${config.dbFile}.tmp`;
    await mkdir(dirname(config.dbFile), { recursive: true });
    await writeFile(temp, JSON.stringify(this.#db, null, 2), 'utf8');
    await rename(temp, config.dbFile);
  }
}

function singular(name) {
  return name.endsWith('ies') ? `${name.slice(0, -3)}y` : name.replace(/s$/, '');
}

export const store = new Store();
