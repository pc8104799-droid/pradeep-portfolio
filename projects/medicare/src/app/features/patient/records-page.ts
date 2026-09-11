import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, lazyState, PatientService, type TimelineEntry } from '@pc/medicare-core';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const KINDS = [
  { id: 'all', label: 'Everything' },
  { id: 'visit', label: 'Visits' },
  { id: 'prescription', label: 'Prescriptions' },
  { id: 'report', label: 'Reports' },
  { id: 'upcoming', label: 'Upcoming' },
] as const;

/**
 * Medical history as a timeline.
 *
 * A patient does not think in tables — they think "the cardiology visit last
 * March, and the blood test that came out of it". So visits, prescriptions,
 * reports and what is booked next are interleaved in one dated column, grouped
 * by year, newest first.
 */
@Component({
  selector: 'mc-records-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Medical history</h1>
          <p>Every visit, prescription and report in one thread — {{ timeline.data()?.total ?? 0 }} entries.</p>
        </div>

        <div class="row row--wrap" role="group" aria-label="Filter history">
          @for (kind of kinds; track kind.id) {
            <button
              type="button"
              class="chip"
              [class.is-active]="filter() === kind.id"
              (click)="filter.set(kind.id)"
            >
              {{ kind.label }}
            </button>
          }
        </div>
      </header>

      <mc-data-state
        [busy]="timeline.loading()"
        [error]="timeline.error()"
        [empty]="timeline.empty()"
        [skeletonLines]="5"
        [skeletonHeight]="3"
        emptyTitle="Your history is empty"
        emptyBody="Once you have been seen, every visit and result lands here."
        (retry)="timeline.load()"
      >
        @if (years().length === 0) {
          <p class="muted">Nothing matches that filter.</p>
        }

        <div class="years" [class.is-reloading]="timeline.reloading()">
          @for (year of years(); track year.year) {
            <section class="year">
              <h2 class="year__label">
                {{ year.year }}
                <span class="muted text-xs">{{ year.entries.length }} entries</span>
              </h2>

              <ol class="thread">
                @for (entry of year.entries; track entry.id) {
                  <li class="thread__item" [class]="'is-' + entry.kind">
                    <span class="thread__dot" aria-hidden="true"></span>

                    <a class="thread__card card card--pad" [routerLink]="entry.link">
                      <span class="thread__date num">{{ entry.date | day: 'short' }}</span>

                      <span class="thread__text">
                        <strong>{{ entry.title }}</strong>
                        <span class="muted text-sm">{{ entry.subtitle }}</span>
                      </span>

                      <span class="badge" [class]="badgeClass(entry)">{{ kindLabel(entry.kind) }}</span>
                    </a>
                  </li>
                }
              </ol>
            </section>
          }
        </div>
      </mc-data-state>
    </section>
  `,
  styles: `
    .years {
      display: grid;
      gap: 1.5rem;
    }

    .year__label {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      font-size: 1rem;
      margin-bottom: 0.6rem;
    }

    .thread {
      display: grid;
      gap: 0.6rem;
      position: relative;
      padding-left: 1.4rem;
    }

    /* The spine runs behind the dots and stops short of the last one, so the
       thread reads as finished rather than cut off. */
    .thread::before {
      content: "";
      position: absolute;
      left: 0.37rem;
      top: 0.9rem;
      bottom: 0.9rem;
      width: 2px;
      background: var(--stroke);
    }

    .thread__item {
      position: relative;
    }

    .thread__dot {
      position: absolute;
      left: -1.22rem;
      top: 1.05rem;
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 50%;
      background: var(--surface);
      border: 2px solid var(--ink-3);
    }

    .is-visit .thread__dot {
      border-color: var(--primary);
    }

    .is-prescription .thread__dot {
      border-color: var(--accent);
    }

    .is-report .thread__dot {
      border-color: var(--success);
    }

    .is-upcoming .thread__dot {
      border-color: var(--warning);
      background: var(--warning);
    }

    .thread__card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.3rem var(--gap-sm);
      align-items: center;
      transition:
        border-color var(--t) var(--ease),
        transform var(--t) var(--ease);
    }

    .thread__card:hover {
      border-color: var(--primary);
      transform: translateX(2px);
    }

    .thread__date {
      grid-column: 1 / -1;
      color: var(--ink-3);
      font-size: 0.74rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .thread__text {
      display: grid;
      min-width: 0;
    }

    .thread__text strong {
      font-family: var(--font-display);
      font-size: 0.92rem;
    }
  `,
})
export class RecordsPage {
  private readonly patients = inject(PatientService);
  private readonly auth = inject(AuthService);

  protected readonly kinds = KINDS;
  protected readonly filter = signal<(typeof KINDS)[number]['id']>('all');

  protected readonly timeline = lazyState(() =>
    this.patients.timeline(this.auth.profileId() ?? ''),
  );

  /**
   * Filtering happens here rather than on the server: the whole history is one
   * small response, and switching filters should be instant.
   */
  protected readonly years = computed(() => {
    const data = this.timeline.data();
    if (!data) return [];

    const kind = this.filter();
    if (kind === 'all') return data.years;

    return data.years
      .map((year) => ({ ...year, entries: year.entries.filter((entry) => entry.kind === kind) }))
      .filter((year) => year.entries.length > 0);
  });

  constructor() {
    void this.timeline.load();
  }

  protected kindLabel(kind: TimelineEntry['kind']): string {
    return { visit: 'Visit', prescription: 'Prescription', report: 'Report', upcoming: 'Booked' }[kind];
  }

  protected badgeClass(entry: TimelineEntry): string {
    return {
      visit: 'badge--primary',
      prescription: 'badge--info',
      report: 'badge--success',
      upcoming: 'badge--warning',
    }[entry.kind];
  }
}
