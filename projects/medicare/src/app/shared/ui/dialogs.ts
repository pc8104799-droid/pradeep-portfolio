import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  Injectable,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Modals and confirmations.
 *
 * Built on the native `<dialog>` element, which brings focus trapping, the
 * backdrop, Escape-to-close and `aria-modal` for free — all the parts a
 * hand-rolled overlay gets wrong.
 */

@Component({
  selector: 'mc-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="modal" (close)="closed.emit()" (click)="onBackdrop($event)">
      <!-- One inner element so a click on the dialog's padding (the backdrop)
           can be told apart from a click on the panel itself. -->
      <div class="modal__panel" [style.--modal-w]="width()">
        <header class="modal__head">
          <h2>{{ heading() }}</h2>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="close()" aria-label="Close">
            ✕
          </button>
        </header>

        <div class="modal__body">
          <ng-content />
        </div>

        <footer class="modal__foot">
          <ng-content select="[slot='actions']" />
        </footer>
      </div>
    </dialog>
  `,
  styles: `
    .modal {
      padding: 0;
      border: 0;
      background: transparent;
      max-width: min(100vw - 2rem, 44rem);
      max-height: calc(100dvh - 2rem);
      color: var(--ink);
    }

    .modal::backdrop {
      background: rgb(6 18 26 / 55%);
      backdrop-filter: blur(2px);
    }

    .modal__panel {
      width: min(var(--modal-w, 32rem), 100%);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      max-height: calc(100dvh - 2rem);
      background: var(--surface);
      border: 1px solid var(--stroke);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      animation: pop var(--t) var(--ease) both;
    }

    .modal__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-sm);
      padding: 1rem var(--pad-card);
      border-bottom: 1px solid var(--stroke);
    }

    .modal__head h2 {
      font-size: 1rem;
    }

    .modal__body {
      padding: var(--pad-card);
      overflow-y: auto;
    }

    .modal__foot:not(:empty) {
      display: flex;
      justify-content: flex-end;
      gap: var(--gap-sm);
      padding: 0.85rem var(--pad-card);
      border-top: 1px solid var(--stroke);
      background: var(--surface-2);
      flex-wrap: wrap;
    }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly heading = input('');
  readonly width = input('32rem');
  /** Set false for a form that should not be lost to a stray backdrop click. */
  readonly dismissable = input(true);

  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;

      if (this.open() && !element.open) element.showModal();
      else if (!this.open() && element.open) element.close();
    });
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onBackdrop(event: MouseEvent): void {
    // The dialog element itself is the backdrop; the panel is a child.
    if (this.dismissable() && event.target === this.dialog().nativeElement) this.close();
  }
}

/* ----------------------------------------------------------- confirmation */

export interface ConfirmRequest {
  readonly heading: string;
  readonly body: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: 'primary' | 'danger';
}

/**
 * Asks before something irreversible.
 *
 * `await confirm.ask(...)` returns a boolean, so a cancel action reads as a
 * straight line of code instead of a callback and a piece of component state.
 * One host renders at the app root, so any component can ask without owning a
 * dialog of its own.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _request = signal<ConfirmRequest | null>(null);
  private resolver: ((answer: boolean) => void) | null = null;

  readonly request = this._request.asReadonly();

  ask(request: ConfirmRequest): Promise<boolean> {
    // A second ask while one is open resolves the first as a cancel rather
    // than leaving its promise hanging forever.
    this.resolver?.(false);

    this._request.set(request);
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  answer(value: boolean): void {
    this._request.set(null);
    this.resolver?.(value);
    this.resolver = null;
  }
}

@Component({
  selector: 'mc-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    @if (confirm.request(); as request) {
      <mc-modal
        [open]="true"
        [heading]="request.heading"
        width="26rem"
        (closed)="confirm.answer(false)"
      >
        <p>{{ request.body }}</p>

        <div slot="actions">
          <button type="button" class="btn btn--ghost" (click)="confirm.answer(false)">
            {{ request.cancelLabel ?? 'Cancel' }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn--danger]="request.tone === 'danger'"
            [class.btn--primary]="request.tone !== 'danger'"
            (click)="confirm.answer(true)"
          >
            {{ request.confirmLabel ?? 'Confirm' }}
          </button>
        </div>
      </mc-modal>
    }
  `,
})
export class ConfirmHost {
  protected readonly confirm = inject(ConfirmService);
}
