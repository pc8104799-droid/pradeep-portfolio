import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Add / plus / minus control used on cards, the product page and the cart. At
 * zero it collapses to a single "Add" button, which is what keeps grocery
 * listings from looking like a spreadsheet.
 */
@Component({
  selector: 'shop-qty-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (qty() === 0) {
      <button
        type="button"
        class="add"
        [disabled]="disabled()"
        (click)="added.emit()"
        [attr.aria-label]="'Add ' + label() + ' to cart'"
      >
        {{ disabled() ? 'Sold out' : 'Add' }}
      </button>
    } @else {
      <div class="stepper" role="group" [attr.aria-label]="'Quantity of ' + label()">
        <button type="button" (click)="decremented.emit()" aria-label="Reduce quantity">−</button>
        <span class="stepper__qty mono-num" aria-live="polite">{{ qty() }}</span>
        <button
          type="button"
          (click)="incremented.emit()"
          [disabled]="qty() >= max()"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .add,
    .stepper {
      height: 34px;
      min-width: 84px;
      border-radius: 99px;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: .85rem;
    }

    .add {
      padding-inline: 1rem;
      border: 1px solid var(--leaf-700);
      color: var(--leaf-700);
      background: var(--bg-2);
      transition: background var(--t) var(--ease-out), color var(--t) var(--ease-out);
    }

    .add:hover:not(:disabled) {
      background: var(--leaf-700);
      color: #fff;
    }

    .add:disabled {
      border-color: var(--stroke);
      color: var(--ink-3);
      cursor: not-allowed;
    }

    .stepper {
      display: inline-grid;
      grid-template-columns: 32px 1fr 32px;
      align-items: center;
      background: var(--leaf-700);
      color: #fff;
      overflow: hidden;
      animation: popIn 180ms var(--ease-spring) both;
    }

    .stepper button {
      height: 100%;
      color: #fff;
      font-size: 1.05rem;
      line-height: 1;
      transition: background var(--t-fast) var(--ease-out);
    }

    .stepper button:hover:not(:disabled) {
      background: rgb(0 0 0 / 16%);
    }

    .stepper button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    .stepper__qty {
      text-align: center;
      font-size: .9rem;
    }
  `,
})
export class QtyStepper {
  readonly qty = input(0);
  readonly max = input(20);
  readonly disabled = input(false);
  /** Used in the accessible labels. */
  readonly label = input('item');

  readonly added = output<void>();
  readonly incremented = output<void>();
  readonly decremented = output<void>();
}
