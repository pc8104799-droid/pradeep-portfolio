import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'shop-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast--' + toast.tone">
          <span class="toast__text">{{ toast.text }}</span>
          @if (toast.action) {
            <button type="button" class="toast__action" (click)="run(toast)">
              {{ toast.action.label }}
            </button>
          }
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
    :host {
      position: fixed;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 5.25rem);
      z-index: 200;
      transform: translateX(-50%);
      width: min(94vw, 420px);
      pointer-events: none;
    }

    @media (min-width: 860px) {
      :host {
        left: auto;
        right: 1.5rem;
        bottom: 1.5rem;
        transform: none;
      }
    }

    .stack {
      display: grid;
      gap: .5rem;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: .7rem .8rem .7rem 1rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--stroke);
      background: var(--bg-2);
      box-shadow: var(--shadow-lg);
      font-size: .9rem;
      pointer-events: auto;
      animation: riseIn 240ms var(--ease-out) both;
    }

    .toast::before {
      content: "";
      width: 4px;
      align-self: stretch;
      border-radius: 99px;
      background: var(--leaf-500);
    }

    .toast--warn::before {
      background: var(--gold);
    }

    .toast--error::before {
      background: var(--berry);
    }

    .toast__text {
      flex: 1;
    }

    .toast__action {
      color: var(--leaf-700);
      font-weight: 700;
      font-size: .85rem;
      white-space: nowrap;
    }

    .toast__close {
      color: var(--ink-3);
      font-size: .8rem;
      padding: .2rem;
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);

  protected run(toast: { action?: { run: () => void }; id: number }): void {
    toast.action?.run();
    this.toasts.dismiss(toast.id);
  }
}
