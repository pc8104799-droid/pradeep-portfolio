import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AbstractControl } from '@angular/forms';

/**
 * Interactive controls shared across forms and lists.
 *
 * Anything that appears in more than one screen and has behaviour — a stepper,
 * a paginator, a search box that debounces — lives here rather than being
 * re-implemented per page.
 */

/* --------------------------------------------------------- field errors */

/**
 * The single place a validation message is chosen.
 *
 * Components pass the control and a label; this decides the wording. That is
 * why "Pincode must be 6 digits" reads the same on registration, on the profile
 * form and at checkout — and why adding a validator does not mean writing a
 * message three times.
 */
@Component({
  selector: 'mc-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <p class="field__error" role="alert">{{ text }}</p>
    }
  `,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();
  readonly label = input('This field');
  /** A message from the server, which always wins over a local rule. */
  readonly serverError = input('');

  protected readonly message = computed(() => {
    if (this.serverError()) return this.serverError();

    const control = this.control();
    // Only complain once the user has actually engaged with the field.
    if (!control.errors || !(control.dirty || control.touched)) return '';

    const errors = control.errors;
    const label = this.label();

    if (errors['required']) return `${label} is required.`;
    if (errors['email']) return 'Enter a valid email address.';
    if (errors['minlength']) {
      return `${label} must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['maxlength']) {
      return `${label} cannot be longer than ${errors['maxlength'].requiredLength} characters.`;
    }
    if (errors['min']) return `${label} must be at least ${errors['min'].min}.`;
    if (errors['max']) return `${label} must be ${errors['max'].max} or less.`;
    if (errors['pattern']) return PATTERN_HINTS[label] ?? `${label} is not in the expected format.`;
    if (errors['mismatch']) return 'Those two do not match.';
    if (errors['future']) return 'Pick a date that is not in the past.';
    if (errors['guardian']) return 'A patient under 18 needs guardian details.';

    return `${label} is not valid.`;
  });
}

/** Pattern failures need field-specific wording to be any use. */
const PATTERN_HINTS: Record<string, string> = {
  'Mobile number': 'Enter a 10-digit mobile number.',
  'Emergency contact': 'Enter a 10-digit mobile number.',
  'Guardian mobile': 'Enter a 10-digit mobile number.',
  Pincode: 'Enter a 6-digit PIN code.',
  'PIN code': 'Enter a 6-digit PIN code.',
};

/* ------------------------------------------------------------- paginator */

@Component({
  selector: 'mc-paginator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pages() > 1) {
      <nav class="pager" aria-label="Pagination">
        <button
          type="button"
          class="btn btn--outline btn--sm"
          [disabled]="page() <= 1"
          (click)="pageChange.emit(page() - 1)"
        >
          ← Previous
        </button>

        <span class="pager__status num">
          Page {{ page() }} of {{ pages() }}
          <span class="muted">· {{ total() }} results</span>
        </span>

        <button
          type="button"
          class="btn btn--outline btn--sm"
          [disabled]="page() >= pages()"
          (click)="pageChange.emit(page() + 1)"
        >
          Next →
        </button>
      </nav>
    }
  `,
  styles: `
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-sm);
      flex-wrap: wrap;
      padding-top: 0.35rem;
    }

    .pager__status {
      font-size: 0.82rem;
      color: var(--ink-2);
    }
  `,
})
export class Paginator {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly total = input(0);

  readonly pageChange = output<number>();
}

/* ---------------------------------------------------------- search field */

/**
 * A debounced search box.
 *
 * The debounce is here rather than in every page because a filter change fires
 * a request: typing "cardio" should be one call, not six.
 */
@Component({
  selector: 'mc-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <label class="search">
      <span class="sr-only">{{ placeholder() }}</span>
      <span class="search__icon" aria-hidden="true">⌕</span>

      <input
        type="search"
        [placeholder]="placeholder()"
        [ngModel]="value()"
        (ngModelChange)="onInput($event)"
        autocomplete="off"
      />

      @if (value()) {
        <button type="button" class="search__clear" (click)="onInput('')" aria-label="Clear search">✕</button>
      }
    </label>
  `,
  styles: `
    .search {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      min-width: min(100%, 14rem);
    }

    input {
      width: 100%;
      padding: 0.55rem 2rem 0.55rem 2.1rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--stroke-strong);
      background: var(--surface);
      font-size: 0.9rem;
    }

    input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    input::-webkit-search-cancel-button {
      display: none;
    }

    .search__icon {
      position: absolute;
      left: 0.7rem;
      color: var(--ink-3);
      font-size: 1.05rem;
      pointer-events: none;
    }

    .search__clear {
      position: absolute;
      right: 0.5rem;
      color: var(--ink-3);
      font-size: 0.75rem;
      padding: 0.2rem;
    }
  `,
})
export class SearchField {
  readonly value = input('');
  readonly placeholder = input('Search');
  readonly debounce = input(280);

  readonly valueChange = output<string>();

  private timer: ReturnType<typeof setTimeout> | undefined;

  protected onInput(value: string): void {
    clearTimeout(this.timer);

    // Clearing the box is an explicit action — no reason to make it wait.
    if (!value) {
      this.valueChange.emit('');
      return;
    }

    this.timer = setTimeout(() => this.valueChange.emit(value), this.debounce());
  }
}

/* ------------------------------------------------------- quantity stepper */

@Component({
  selector: 'mc-qty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qty">
      <button
        type="button"
        [disabled]="value() <= min()"
        (click)="valueChange.emit(value() - 1)"
        [attr.aria-label]="'Reduce quantity of ' + label()"
      >
        −
      </button>

      <span class="qty__value num" aria-live="polite">{{ value() }}</span>

      <button
        type="button"
        [disabled]="value() >= max()"
        (click)="valueChange.emit(value() + 1)"
        [attr.aria-label]="'Increase quantity of ' + label()"
      >
        +
      </button>
    </div>
  `,
  styles: `
    .qty {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--stroke-strong);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }

    button {
      width: 2rem;
      height: 2rem;
      display: grid;
      place-items: center;
      font-size: 1rem;
      font-weight: 600;
      color: var(--primary);
      transition: background var(--t-fast) var(--ease);
    }

    button:hover:not(:disabled) {
      background: var(--primary-soft);
    }

    button:disabled {
      color: var(--ink-3);
      cursor: not-allowed;
    }

    .qty__value {
      min-width: 2rem;
      text-align: center;
      font-weight: 600;
      font-size: 0.88rem;
      border-inline: 1px solid var(--stroke);
      align-self: stretch;
      display: grid;
      place-items: center;
    }
  `,
})
export class QuantityStepper {
  readonly value = input.required<number>();
  readonly min = input(1);
  readonly max = input(10);
  readonly label = input('item');

  readonly valueChange = output<number>();
}

/* ----------------------------------------------------------------- stepper */

export interface Step {
  readonly id: string;
  readonly label: string;
}

/** The progress rail above a multi-step flow (booking, checkout). */
@Component({
  selector: 'mc-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="steps" [attr.aria-label]="'Step ' + (activeIndex() + 1) + ' of ' + steps().length">
      @for (step of steps(); track step.id; let index = $index) {
        <li
          class="step"
          [class.is-done]="index < activeIndex()"
          [class.is-active]="index === activeIndex()"
          [attr.aria-current]="index === activeIndex() ? 'step' : null"
        >
          <!-- Completed steps are clickable so a wizard can be revisited
               without losing what has already been chosen. -->
          @if (index < activeIndex()) {
            <button type="button" class="step__mark" (click)="jump.emit(index)">✓</button>
          } @else {
            <span class="step__mark">{{ index + 1 }}</span>
          }

          <span class="step__label">{{ step.label }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .steps {
      display: flex;
      gap: 0.2rem;
      overflow-x: auto;
      padding-bottom: 0.2rem;
      scrollbar-width: none;
    }

    .steps::-webkit-scrollbar {
      display: none;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding-right: 0.6rem;
      flex: none;
      color: var(--ink-3);
      font-size: 0.8rem;
    }

    .step:not(:last-child)::after {
      content: "";
      width: 1.25rem;
      height: 1px;
      background: var(--stroke-strong);
    }

    .step__mark {
      display: grid;
      place-items: center;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: var(--radius-pill);
      background: var(--surface-3);
      color: var(--ink-3);
      font-family: var(--font-display);
      font-size: 0.75rem;
      font-weight: 700;
      flex: none;
    }

    .step.is-done .step__mark {
      background: var(--success-soft);
      color: var(--success);
      cursor: pointer;
    }

    .step.is-active .step__mark {
      background: var(--primary);
      color: var(--primary-ink);
    }

    .step.is-active,
    .step.is-done {
      color: var(--ink);
      font-weight: 500;
    }

    .step__label {
      white-space: nowrap;
    }

    @media (max-width: 560px) {
      /* On a phone only the current step keeps its label; the rest stay as
         numbered dots so the rail still fits without scrolling. */
      .step:not(.is-active) .step__label {
        display: none;
      }
    }
  `,
})
export class Stepper {
  readonly steps = input.required<readonly Step[]>();
  readonly activeIndex = input.required<number>();

  readonly jump = output<number>();
}

export const MC_CONTROLS = [
  FieldError,
  Paginator,
  SearchField,
  QuantityStepper,
  Stepper,
] as const;
