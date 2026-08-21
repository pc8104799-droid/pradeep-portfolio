import { computed, Injectable, signal } from '@angular/core';
import type { ContentListKey, PortfolioContent } from '../models/resume.models';
import FALLBACK_CONTENT from '../data/content.json';

const STORAGE_KEY = 'pc-portfolio-content';
const CONTENT_URL = 'content.json';

/**
 * The content compiled into the bundle. Exported so tests and tooling can
 * compare against the shipped baseline without reaching for the file path.
 */
export const BUNDLED_CONTENT = FALLBACK_CONTENT as unknown as PortfolioContent;

/** Deep clone that keeps the content plain and JSON-safe. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Owns every piece of site content.
 *
 * Load order: local edits (localStorage) → `content.json` fetched at startup →
 * the copy bundled at build time. That means the deployed JSON can be edited
 * without a rebuild, the site can never render empty, and anything changed in
 * the admin area survives a refresh until it is exported and committed.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly _content = signal<PortfolioContent>(
    clone(FALLBACK_CONTENT as unknown as PortfolioContent),
  );

  /** True when the in-browser copy differs from the file it was loaded from. */
  private readonly _dirty = signal(false);
  /** Where the current content came from, surfaced in the admin footer. */
  private readonly _source = signal<'bundled' | 'file' | 'local-edits'>('bundled');

  readonly content = this._content.asReadonly();
  readonly dirty = this._dirty.asReadonly();
  readonly source = this._source.asReadonly();

  // Slice signals — components read only what they need.
  readonly profile = computed(() => this._content().profile);
  readonly socials = computed(() => this._content().socials);
  readonly nav = computed(() => this._content().nav);
  readonly stats = computed(() => this._content().stats);
  readonly services = computed(() => this._content().services);
  readonly coreStack = computed(() => this._content().coreStack);
  readonly skillGroups = computed(() => this._content().skillGroups);
  readonly experiences = computed(() => this._content().experiences);
  readonly projects = computed(() => this._content().projects);
  readonly education = computed(() => this._content().education);
  readonly languages = computed(() => this._content().languages);
  readonly marquee = computed(() => this._content().marquee);

  /**
   * Called once before the app renders, so every section can read content
   * synchronously and no section needs a loading state.
   */
  async load(): Promise<void> {
    const stored = this.readStored();
    if (stored) {
      this._content.set(stored);
      this._source.set('local-edits');
      this._dirty.set(true);
      return;
    }

    try {
      const response = await fetch(CONTENT_URL, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this._content.set(this.merge(await response.json()));
      this._source.set('file');
    } catch {
      // Keep the bundled copy — a missing or malformed file must never blank
      // out the portfolio.
      this._source.set('bundled');
    }
  }

  // ---------------------------------------------------------------- mutations

  /** Replaces one top-level branch (profile, education, …). */
  patch<K extends keyof PortfolioContent>(key: K, value: PortfolioContent[K]): void {
    this.commit({ ...this._content(), [key]: value });
  }

  /** Replaces several top-level branches at once. */
  patchMany(partial: Partial<PortfolioContent>): void {
    this.commit({ ...this._content(), ...partial });
  }

  add<K extends ContentListKey>(key: K, item: PortfolioContent[K][number]): void {
    const list = [...(this._content()[key] as unknown[]), item] as PortfolioContent[K];
    this.commit({ ...this._content(), [key]: list });
  }

  update<K extends ContentListKey>(
    key: K,
    index: number,
    item: PortfolioContent[K][number],
  ): void {
    const list = [...(this._content()[key] as unknown[])];
    list[index] = item;
    this.commit({ ...this._content(), [key]: list as PortfolioContent[K] });
  }

  remove<K extends ContentListKey>(key: K, index: number): void {
    const list = (this._content()[key] as unknown[]).filter((_, i) => i !== index);
    this.commit({ ...this._content(), [key]: list as PortfolioContent[K] });
  }

  /** Moves an entry by `delta`, clamped to the ends of the list. */
  move<K extends ContentListKey>(key: K, index: number, delta: number): void {
    const list = [...(this._content()[key] as unknown[])];
    const target = index + delta;

    if (target < 0 || target >= list.length) {
      return;
    }

    [list[index], list[target]] = [list[target], list[index]];
    this.commit({ ...this._content(), [key]: list as PortfolioContent[K] });
  }

  // -------------------------------------------------------------- persistence

  /** The content as the file should look on disk. */
  serialise(): string {
    return `${JSON.stringify(this._content(), null, 2)}\n`;
  }

  /** Hands the visitor a content.json to drop into the repo. */
  download(): void {
    const blob = new Blob([this.serialise()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'content.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Accepts a pasted or uploaded file. Throws if it is not valid content. */
  import(raw: string): void {
    const parsed = JSON.parse(raw) as Partial<PortfolioContent>;

    if (!parsed || typeof parsed !== 'object' || !parsed.profile) {
      throw new Error('That does not look like a portfolio content file.');
    }

    this.commit(this.merge(parsed));
  }

  /** Drops local edits and goes back to the shipped file. */
  async reset(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }

    this._content.set(clone(FALLBACK_CONTENT as unknown as PortfolioContent));
    this._dirty.set(false);
    await this.load();
  }

  // ------------------------------------------------------------------ private

  private commit(next: PortfolioContent): void {
    this._content.set(next);
    this._dirty.set(true);
    this._source.set('local-edits');

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode or a full quota — edits still apply for this session.
    }
  }

  private readStored(): PortfolioContent | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? this.merge(JSON.parse(raw) as Partial<PortfolioContent>) : null;
    } catch {
      return null;
    }
  }

  /**
   * Fills any branch the incoming file is missing from the bundled copy, so an
   * older export (or a hand-edited file) cannot break a section.
   */
  private merge(incoming: Partial<PortfolioContent>): PortfolioContent {
    return { ...clone(FALLBACK_CONTENT as unknown as PortfolioContent), ...clone(incoming) };
  }
}
