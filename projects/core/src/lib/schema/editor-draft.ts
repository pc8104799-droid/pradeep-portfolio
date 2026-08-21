import { computed, signal } from '@angular/core';
import type { FieldDef } from './content-schema';
import { getPath, setPath } from './path.util';

/**
 * Draft state for one form.
 *
 * Field keys can be dotted paths, which reactive forms handle awkwardly, so the
 * draft is held flat (keyed by the field's path) and folded back into a real
 * object on save. Plain signals — no DI, so it works anywhere.
 */
export class EditorDraft {
  private readonly values = signal<Record<string, unknown>>({});
  private readonly _touched = signal(false);
  private readonly _pristine = signal(true);

  /** The object the draft was loaded from; unedited keys are preserved on save. */
  private base: Record<string, unknown> = {};

  readonly touched = this._touched.asReadonly();
  /** True until the first edit — drives the disabled state of Save. */
  readonly pristine = this._pristine.asReadonly();

  /** Required fields that are still empty. */
  readonly missing = computed(() =>
    this.fields.filter((field) => {
      if (!field.required) {
        return false;
      }

      const value = this.values()[field.key];
      return Array.isArray(value) ? value.length === 0 : value === '' || value == null;
    }),
  );

  readonly valid = computed(() => this.missing().length === 0);

  constructor(private readonly fields: readonly FieldDef[]) {}

  /** Populates the draft from an existing object (or a blank template). */
  load(source: unknown): void {
    this.base = (source ?? {}) as Record<string, unknown>;
    this.values.set(
      Object.fromEntries(this.fields.map((field) => [field.key, getPath(source, field.key)])),
    );
    this._touched.set(false);
    this._pristine.set(true);
  }

  valueOf(key: string): unknown {
    return this.values()[key];
  }

  set(key: string, value: unknown): void {
    this.values.update((current) => ({ ...current, [key]: value }));
    this._touched.set(true);
    this._pristine.set(false);
  }

  markTouched(): void {
    this._touched.set(true);
  }

  /** Folds the flat draft back onto a copy of the object it came from. */
  build<T>(): T {
    const values = this.values();

    return this.fields.reduce<Record<string, unknown>>(
      (item, field) => setPath(item, field.key, values[field.key]),
      JSON.parse(JSON.stringify(this.base)) as Record<string, unknown>,
    ) as T;
  }
}
