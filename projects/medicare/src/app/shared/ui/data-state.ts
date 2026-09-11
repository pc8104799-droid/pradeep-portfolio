import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ApiError } from '@pc/medicare-core';

/**
 * The loading / error / empty wrapper every data-backed panel goes through.
 *
 * It exists so no page ever ships three `@if` branches of its own, and so all
 * four states look the same everywhere. Content is projected, so the wrapper
 * never has to know what it is wrapping:
 *
 * ```html
 * <mc-data-state [busy]="rx.busy()" [error]="rx.error()" [empty]="rx.empty()"
 *                emptyTitle="No prescriptions yet" (retry)="rx.load()">
 *   ...the real content...
 * </mc-data-state>
 * ```
 *
 * The distinction that matters: `busy` with nothing loaded yet shows a
 * skeleton, whereas a refresh of data already on screen is left to the caller
 * to dim with `.is-reloading`. Replacing a populated screen with a skeleton on
 * every filter change is the jarring thing this avoids.
 */
@Component({
  selector: 'mc-data-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <div class="state state--error" role="alert">
        <span class="state__mark" aria-hidden="true">!</span>
        <div>
          <h3>{{ errorTitle() }}</h3>
          <p>{{ error()!.message }}</p>

          @if (error()!.status === 0) {
            <p class="muted text-sm">
              The API runs separately from this app. Start it with
              <code class="mono">npm run api</code> in the project root.
            </p>
          }
        </div>

        <button type="button" class="btn btn--outline btn--sm" (click)="retry.emit()">
          Try again
        </button>
      </div>
    } @else if (busy()) {
      <div class="state state--busy" role="status" aria-live="polite">
        <span class="sr-only">Loading…</span>

        @for (row of skeletonRows(); track row) {
          <div class="skeleton" [style.height.rem]="skeletonHeight()"></div>
        }
      </div>
    } @else if (empty()) {
      <div class="state state--empty">
        <span class="state__mark state__mark--quiet" aria-hidden="true">{{ emptyIcon() }}</span>
        <div>
          <h3>{{ emptyTitle() }}</h3>
          @if (emptyBody()) {
            <p>{{ emptyBody() }}</p>
          }
        </div>
        <ng-content select="[slot='empty-action']" />
      </div>
    } @else {
      <ng-content />
    }
  `,
  styles: `
    .state {
      display: grid;
      gap: 0.75rem;
      padding: clamp(1.25rem, 3vw, 2.25rem);
      border: 1px solid var(--stroke);
      border-radius: var(--radius);
      background: var(--surface);
      text-align: center;
      justify-items: center;
      animation: pop var(--t) var(--ease) both;
    }

    .state--busy {
      padding: var(--pad-card);
      gap: 0.6rem;
      justify-items: stretch;
      text-align: left;
      animation: none;
    }

    .state h3 {
      font-size: 0.98rem;
    }

    .state p {
      color: var(--ink-2);
      font-size: 0.88rem;
      max-width: 46ch;
      margin-top: 0.2rem;
    }

    .state__mark {
      display: grid;
      place-items: center;
      width: 2.6rem;
      height: 2.6rem;
      border-radius: var(--radius-pill);
      background: var(--danger-soft);
      color: var(--danger);
      font-family: var(--font-display);
      font-size: 1.3rem;
      font-weight: 700;
    }

    .state__mark--quiet {
      background: var(--surface-3);
      color: var(--ink-3);
      font-size: 1.15rem;
    }

    code {
      padding: 0.1rem 0.35rem;
      border-radius: var(--radius-xs);
      background: var(--surface-3);
    }
  `,
})
export class DataState {
  /** True only for a first load — a reload keeps the current content. */
  readonly busy = input(false);
  readonly error = input<ApiError | null>(null);
  readonly empty = input(false);

  readonly errorTitle = input('That did not load');
  readonly emptyTitle = input('Nothing here yet');
  readonly emptyBody = input('');
  readonly emptyIcon = input('·');

  /** How much skeleton to show, matched roughly to the real content. */
  readonly skeletonLines = input(3);
  readonly skeletonHeight = input(3);

  readonly retry = output<void>();

  protected skeletonRows(): number[] {
    return Array.from({ length: Math.max(1, this.skeletonLines()) }, (_value, index) => index);
  }
}
