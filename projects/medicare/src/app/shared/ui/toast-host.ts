import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '@pc/medicare-core';

/**
 * The toast stack.
 *
 * `aria-live="polite"` rather than `assertive`: these are confirmations, and
 * interrupting a screen reader mid-sentence to say "saved" is worse than
 * waiting for a pause.
 */
@Component({
  selector: 'mc-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="toasts" role="status" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.tone">
          <span class="toast__mark" aria-hidden="true">{{ mark(toast.tone) }}</span>

          <div class="toast__text">
            <strong>{{ toast.title }}</strong>
            @if (toast.body) {
              <span class="toast__body">{{ toast.body }}</span>
            }
            @if (toast.action; as action) {
              <a class="toast__action" [routerLink]="action.link" (click)="toasts.dismiss(toast.id)">
                {{ action.label }} →
              </a>
            }
          </div>

          <button
            type="button"
            class="toast__close"
            (click)="toasts.dismiss(toast.id)"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      z-index: 60;
      inset-inline: 0.75rem;
      bottom: 0.75rem;
      display: grid;
      gap: 0.5rem;
      justify-items: stretch;
      pointer-events: none;
    }

    @media (min-width: 640px) {
      .toasts {
        inset-inline: auto 1.25rem;
        bottom: 1.25rem;
        width: 22rem;
      }
    }

    .toast {
      pointer-events: auto;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 0.6rem;
      align-items: start;
      padding: 0.7rem 0.8rem;
      border-radius: var(--radius);
      border: 1px solid var(--stroke);
      background: var(--surface);
      box-shadow: var(--shadow);
      animation: rise var(--t) var(--ease) both;
    }

    .toast__mark {
      display: grid;
      place-items: center;
      width: 1.4rem;
      height: 1.4rem;
      border-radius: var(--radius-pill);
      font-size: 0.8rem;
      font-weight: 700;
      flex: none;
    }

    .toast--success .toast__mark {
      background: var(--success-soft);
      color: var(--success);
    }

    .toast--error .toast__mark {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .toast--warning .toast__mark {
      background: var(--warning-soft);
      color: var(--warning);
    }

    .toast--info .toast__mark {
      background: var(--info-soft);
      color: var(--info);
    }

    .toast__text {
      display: grid;
      gap: 0.1rem;
      font-size: 0.86rem;
      min-width: 0;
    }

    .toast__body {
      color: var(--ink-2);
      font-size: 0.82rem;
    }

    .toast__action {
      color: var(--primary);
      font-weight: 600;
      font-size: 0.82rem;
      margin-top: 0.15rem;
    }

    .toast__close {
      color: var(--ink-3);
      font-size: 0.75rem;
      padding: 0.15rem;
      line-height: 1;
    }

    .toast__close:hover {
      color: var(--ink);
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);

  protected mark(tone: string): string {
    return { success: '✓', error: '!', warning: '!', info: 'i' }[tone] ?? 'i';
  }
}
