import { computed, effect, signal, untracked, type Signal } from '@angular/core';
import { ApiError } from './api-error';

export type LoadState = 'idle' | 'loading' | 'reloading' | 'ready' | 'error';

/**
 * The four states every screen in this app has to render.
 *
 * `AsyncState` exists so no component writes its own trio of `loading`,
 * `error` and `data` signals. It also draws the distinction that actually
 * matters on screen: a first load shows a skeleton, a reload keeps the stale
 * data visible and only dims it, and an empty result is a state of its own
 * rather than "no data yet".
 */
export class AsyncState<T> {
  private readonly _data = signal<T | null>(null);
  private readonly _error = signal<ApiError | null>(null);
  private readonly _state = signal<LoadState>('idle');

  /** Guards against a slow first request overwriting a fast second one. */
  private sequence = 0;

  readonly data = this._data.asReadonly();
  readonly error = this._error.asReadonly();
  readonly state = this._state.asReadonly();

  /** True only for the very first load — the one that gets a skeleton. */
  readonly loading = computed(() => this._state() === 'loading');
  /** True while refreshing data that is already on screen. */
  readonly reloading = computed(() => this._state() === 'reloading');
  readonly busy = computed(() => this.loading() || this.reloading());
  readonly ready = computed(() => this._state() === 'ready');
  readonly failed = computed(() => this._state() === 'error');

  /**
   * True when the call succeeded and there is genuinely nothing to show.
   * An empty array, an empty page envelope and a null body all count.
   */
  readonly empty = computed(() => {
    if (!this.ready()) return false;

    const value = this._data();
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object' && 'items' in value) {
      return (value as { items: readonly unknown[] }).items.length === 0;
    }

    return false;
  });

  constructor(private readonly loader: () => Promise<T>) {}

  /** Runs the loader, keeping whatever is already on screen until it answers. */
  async load(): Promise<T | null> {
    const ticket = ++this.sequence;

    this._state.set(this._data() === null ? 'loading' : 'reloading');
    this._error.set(null);

    try {
      const value = await this.loader();

      // A newer load started while this one was in flight: discard this result.
      if (ticket !== this.sequence) return this._data();

      this._data.set(value);
      this._state.set('ready');
      return value;
    } catch (error) {
      if (ticket !== this.sequence) return this._data();

      this._error.set(asApiError(error));
      this._state.set('error');
      return null;
    }
  }

  /** Writes a value in without a request — used after a successful mutation. */
  set(value: T): void {
    this.sequence += 1;
    this._data.set(value);
    this._error.set(null);
    this._state.set('ready');
  }

  /** Applies a local change to loaded data so the UI does not have to refetch. */
  patch(update: (current: T) => T): void {
    const current = this._data();
    if (current !== null) this.set(update(current));
  }

  reset(): void {
    this.sequence += 1;
    this._data.set(null);
    this._error.set(null);
    this._state.set('idle');
  }
}

/** Creates an `AsyncState` and starts loading immediately. */
export function asyncState<T>(loader: () => Promise<T>): AsyncState<T> {
  const state = new AsyncState(loader);
  void state.load();
  return state;
}

/** Creates an `AsyncState` that waits for an explicit `load()`. */
export function lazyState<T>(loader: () => Promise<T>): AsyncState<T> {
  return new AsyncState(loader);
}

/**
 * An `AsyncState` that reloads whenever the signals it watches change.
 *
 * This is what detail pages use. A required route `input()` cannot be read
 * while fields are still initialising, and it changes when the user navigates
 * from one record to the next — both problems disappear if the load is driven
 * by an effect instead of by construction:
 *
 * ```ts
 * readonly doctorId = input.required<string>();
 * protected readonly doctor = trackedState(
 *   () => this.doctorId(),
 *   () => this.catalog.doctor(this.doctorId()),
 * );
 * ```
 *
 * Must be called in an injection context, which a field initialiser is.
 */
export function trackedState<T>(track: () => unknown, loader: () => Promise<T>): AsyncState<T> {
  const state = new AsyncState(loader);

  effect(() => {
    // Read the tracked values so the effect re-runs when they change, then step
    // outside the reactive context: the loader touches services and signals of
    // its own, and none of those should become dependencies.
    track();
    untracked(() => void state.load());
  });

  return state;
}

/**
 * Wraps a one-off mutation — saving a form, paying, cancelling — in the same
 * busy/error pair, so a submit button and its inline error come from one place.
 */
export class ActionState {
  private readonly _busy = signal(false);
  private readonly _error = signal<ApiError | null>(null);

  readonly busy = this._busy.asReadonly();
  readonly error = this._error.asReadonly();

  readonly fieldErrors: Signal<Readonly<Record<string, string>>> = computed(
    () => this._error()?.details ?? {},
  );

  /**
   * Runs `work`, returning its result or `null` if it failed. The error is kept
   * on the state rather than rethrown, so callers read like
   * `if (await action.run(...)) { navigate() }`.
   */
  async run<T>(work: () => Promise<T>): Promise<T | null> {
    if (this._busy()) return null;

    this._busy.set(true);
    this._error.set(null);

    try {
      return await work();
    } catch (error) {
      this._error.set(asApiError(error));
      return null;
    } finally {
      this._busy.set(false);
    }
  }

  clear(): void {
    this._error.set(null);
  }
}

/** Anything thrown anywhere becomes an `ApiError` before a template sees it. */
export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  return new ApiError(0, error instanceof Error ? error.message : 'Something went wrong.');
}
