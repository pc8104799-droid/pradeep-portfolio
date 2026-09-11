import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InrPipe } from '../pipes';

/**
 * The small display components the whole app builds pages out of.
 *
 * They are grouped in one file because they share a vocabulary — a status, a
 * number, a person — and because a page usually imports several of them at once.
 */

/* ---------------------------------------------------------- status badge */

/**
 * Maps every status string in the domain to a tone.
 *
 * Keeping this table in one place is what stops "cancelled" from being red on
 * one screen and grey on another. Anything unlisted falls back to neutral
 * rather than guessing.
 */
const TONES: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'> = {
  // Appointments
  pending: 'warning',
  confirmed: 'info',
  'checked-in': 'primary',
  'in-consultation': 'primary',
  completed: 'success',
  cancelled: 'danger',
  rescheduled: 'warning',
  'no-show': 'danger',

  // Queue
  waiting: 'warning',
  called: 'primary',

  // Payments
  successful: 'success',
  processing: 'info',
  failed: 'danger',
  refunded: 'neutral',

  // Orders
  placed: 'info',
  preparing: 'warning',
  'ready-for-pickup': 'primary',
  'out-for-delivery': 'primary',
  delivered: 'success',

  // Reports and tests
  normal: 'success',
  attention: 'warning',
  requested: 'info',
  scheduled: 'info',
  'sample-collected': 'warning',
  'report-available': 'success',

  // Prescriptions and stock
  active: 'success',
  verified: 'success',
  required: 'danger',
  'not-required': 'neutral',
  urgent: 'danger',
  routine: 'neutral',
  'in-stock': 'success',
  'out-of-stock': 'danger',
  online: 'info',
  'in-person': 'neutral',
  'follow-up': 'info',
  new: 'primary',
};

@Component({
  selector: 'mc-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="'badge--' + tone()">
      @if (dot()) {
        <span class="badge__dot" [class.badge__dot--live]="live()" aria-hidden="true"></span>
      }
      {{ label() }}
    </span>
  `,
})
export class StatusBadge {
  readonly status = input.required<string>();
  /** Overrides the label when the raw status is not what a person should read. */
  readonly text = input('');
  readonly dot = input(true);

  protected readonly tone = computed(() => {
    const mapped = TONES[this.status()];
    return mapped && mapped !== 'neutral' ? mapped : '';
  });

  protected readonly label = computed(() => {
    if (this.text()) return this.text();

    const words = this.status().replaceAll('-', ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  });

  /** A pulsing dot for the two statuses that mean "happening right now". */
  protected readonly live = computed(() =>
    ['in-consultation', 'called', 'out-for-delivery', 'processing'].includes(this.status()),
  );
}

/* -------------------------------------------------------------- stat tile */

/**
 * One number with a label. The whole point is that the number is the biggest
 * thing in the tile, and the label never competes with it.
 */
@Component({
  selector: 'mc-stat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InrPipe],
  template: `
    <div class="stat card card--pad" [class.stat--link]="link()">
      <!--
        When the tile links somewhere, one stretched anchor covers the whole
        card. That keeps a single accessible link with a real label, rather than
        a click handler on a div or the same markup duplicated in two branches.
      -->
      @if (link(); as target) {
        <a class="stat__hit" [routerLink]="target">
          <span class="sr-only">{{ label() }}</span>
        </a>
      }

      <span class="stat__label">{{ label() }}</span>

      <strong class="stat__value num">
        @if (currency()) {
          {{ numeric() | inr }}
        } @else {
          {{ value() }}
        }
        @if (suffix()) {
          <span class="stat__suffix">{{ suffix() }}</span>
        }
      </strong>

      @if (hint()) {
        <span class="stat__hint" [class]="tone() ? 'stat__hint--' + tone() : ''">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .stat {
      position: relative;
      display: grid;
      gap: 0.2rem;
      align-content: start;
      height: 100%;
      transition:
        border-color var(--t) var(--ease),
        transform var(--t) var(--ease);
    }

    .stat__hit {
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }

    .stat--link:hover {
      border-color: var(--primary);
      transform: translateY(-2px);
    }

    .stat__hit:focus-visible {
      outline: var(--ring-width) solid var(--primary);
      outline-offset: var(--ring-offset);
    }

    .stat__label {
      color: var(--ink-3);
      font-size: 0.76rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat__value {
      font-family: var(--font-display);
      font-size: clamp(1.35rem, 2.4vw, 1.75rem);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }

    .stat__suffix {
      font-size: 0.7em;
      font-weight: 600;
      color: var(--ink-3);
      margin-left: 0.15rem;
    }

    .stat__hint {
      color: var(--ink-3);
      font-size: 0.79rem;
    }

    .stat__hint--success {
      color: var(--success);
    }

    .stat__hint--warning {
      color: var(--warning);
    }

    .stat__hint--danger {
      color: var(--danger);
    }
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input('');
  readonly suffix = input('');
  readonly currency = input(false);
  readonly tone = input<'' | 'success' | 'warning' | 'danger'>('');
  readonly link = input<string | readonly string[] | null>(null);

  /** `value` is widened to a string for plain counts; money must be a number. */
  protected readonly numeric = computed(() => Number(this.value()) || 0);
}

/* ---------------------------------------------------------------- person */

/** An avatar plus a name and one line under it — used in every list of people. */
@Component({
  selector: 'mc-person',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="avatar" [class.avatar--sm]="size() === 'sm'" [class.avatar--lg]="size() === 'lg'" aria-hidden="true">
      {{ initials() }}
    </span>

    <span class="person__text">
      <strong class="person__name truncate">{{ name() }}</strong>
      @if (meta()) {
        <span class="person__meta truncate">{{ meta() }}</span>
      }
    </span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      min-width: 0;
    }

    .person__text {
      display: grid;
      min-width: 0;
    }

    .person__name {
      font-family: var(--font-display);
      font-size: 0.9rem;
      font-weight: 600;
    }

    .person__meta {
      color: var(--ink-3);
      font-size: 0.78rem;
    }
  `,
})
export class Person {
  readonly name = input.required<string>();
  readonly meta = input('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  protected readonly initials = computed(() => {
    const words = this.name()
      .replace(/^Dr\.?\s+/i, '')
      .split(/\s+/)
      .filter(Boolean);

    return (
      words
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  });
}

/* ------------------------------------------------------------ inline note */

/** A short coloured note: an allergy warning, a refund, a demo disclaimer. */
@Component({
  selector: 'mc-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="note__mark" aria-hidden="true">{{ mark() }}</span>
    <span class="note__text"><ng-content /></span>
  `,
  host: { '[class]': '"note note--" + tone()', '[attr.role]': 'tone() === "danger" ? "alert" : null' },
  styles: `
    .note {
      display: flex;
      align-items: flex-start;
      gap: 0.55rem;
      padding: 0.65rem 0.8rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--stroke);
      font-size: 0.85rem;
      line-height: 1.45;
    }

    .note--info {
      background: var(--info-soft);
      color: var(--info);
      border-color: transparent;
    }

    .note--warning {
      background: var(--warning-soft);
      color: var(--warning);
      border-color: transparent;
    }

    .note--danger {
      background: var(--danger-soft);
      color: var(--danger);
      border-color: transparent;
    }

    .note--success {
      background: var(--success-soft);
      color: var(--success);
      border-color: transparent;
    }

    .note__mark {
      font-weight: 700;
      flex: none;
    }

    .note__text {
      min-width: 0;
    }
  `,
})
export class InlineNote {
  readonly tone = input<'info' | 'warning' | 'danger' | 'success'>('info');

  protected readonly mark = computed(
    () => ({ info: 'i', warning: '!', danger: '!', success: '✓' })[this.tone()],
  );
}

/** Every atom above, for a component's `imports` array. */
export const MC_ATOMS = [StatusBadge, StatTile, Person, InlineNote] as const;
