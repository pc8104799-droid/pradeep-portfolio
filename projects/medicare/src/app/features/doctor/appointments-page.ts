import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppointmentService, lazyState, type AppointmentQuery } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
] as const;

const STATUSES = [
  '',
  'confirmed',
  'checked-in',
  'in-consultation',
  'completed',
  'cancelled',
  'no-show',
];

/**
 * The doctor's appointment book.
 *
 * A table rather than cards: a doctor scanning a fortnight wants rows they can
 * compare, and the useful action per row depends on whether the visit is ahead
 * of them or behind them.
 */
@Component({
  selector: 'mc-doctor-appointments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Appointments</h1>
          <p>{{ list.data()?.total ?? 0 }} in this view.</p>
        </div>

        <a class="btn btn--primary" routerLink="/doctor/queue">Open today's queue</a>
      </header>

      <div class="spread">
        <div class="row row--wrap" role="tablist" aria-label="Appointment range">
          @for (option of tabs; track option.id) {
            <button
              type="button"
              role="tab"
              class="chip"
              [class.is-active]="tab() === option.id"
              [attr.aria-selected]="tab() === option.id"
              (click)="setTab(option.id)"
            >
              {{ option.label }}
            </button>
          }
        </div>

        <div class="row row--wrap">
          <label class="field status">
            <span class="sr-only">Status</span>
            <select [ngModel]="status()" (ngModelChange)="setStatus($event)">
              @for (option of statuses; track option) {
                <option [value]="option">{{ option ? (option | label) : 'Any status' }}</option>
              }
            </select>
          </label>

          <mc-search
            [value]="search()"
            placeholder="Patient name or appointment ID"
            (valueChange)="setSearch($event)"
          />
        </div>
      </div>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="5"
        [skeletonHeight]="3.5"
        emptyTitle="No appointments in this view"
        emptyBody="Try a different range, or clear the status filter."
        (retry)="list.load()"
      >
        <div class="card card--flush" [class.is-reloading]="list.reloading()">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Patient</th>
                  <th>Reason</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (appointment of list.data()?.items ?? []; track appointment.id) {
                  <tr [class.is-today]="appointment.date === today">
                    <td>
                      <strong class="num">{{ appointment.date | day: 'short' }}</strong>
                      <div class="muted text-xs num">{{ appointment.time | clock }}</div>
                    </td>
                    <td>
                      <mc-person [name]="appointment.patientName" [meta]="appointment.patientId" size="sm" />
                    </td>
                    <td class="reason">
                      <span class="truncate" [title]="appointment.reason">{{ appointment.reason }}</span>
                      @if (appointment.token) {
                        <span class="badge badge--primary">Token {{ appointment.token }}</span>
                      }
                    </td>
                    <td>
                      <span class="badge">{{ appointment.visitType | label }}</span>
                      <span class="badge">{{ appointment.consultationType | label }}</span>
                    </td>
                    <td><mc-status [status]="appointment.status" /></td>
                    <td class="cell-actions">
                      @if (['confirmed', 'checked-in', 'in-consultation'].includes(appointment.status)) {
                        <a class="btn btn--primary btn--sm" [routerLink]="['/doctor/consultation', appointment.id]">
                          Consult
                        </a>
                      }
                      <a class="btn btn--outline btn--sm" [routerLink]="['/doctor/appointments', appointment.id]">
                        Open
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        @if (list.data(); as page) {
          <mc-paginator [page]="page.page" [pages]="page.pages" [total]="page.total" (pageChange)="setPage($event)" />
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    .status {
      max-width: 11rem;
    }

    .reason {
      max-width: 20rem;
    }

    .reason span.truncate {
      display: block;
    }

    /* Today's rows carry a rail so they stand out in a long list. */
    tr.is-today td:first-child {
      box-shadow: inset 3px 0 0 var(--primary);
    }

    td .badge + .badge {
      margin-left: 0.25rem;
    }
  `,
})
export class DoctorAppointmentsPage {
  private readonly appointments = inject(AppointmentService);

  protected readonly tabs = TABS;
  protected readonly statuses = STATUSES;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly tab = signal<(typeof TABS)[number]['id']>('today');
  protected readonly status = signal('');
  protected readonly search = signal('');
  protected readonly page = signal(1);

  protected readonly list = lazyState(() => this.appointments.list(this.query()));

  constructor() {
    void this.list.load();
  }

  private query(): AppointmentQuery {
    const tab = this.tab();

    return {
      q: this.search(),
      status: this.status(),
      date: tab === 'today' ? this.today : undefined,
      upcoming: tab === 'upcoming' || undefined,
      past: tab === 'past' || undefined,
      sort: tab === 'past' ? '-date' : 'date',
      page: this.page(),
      limit: 15,
    };
  }

  protected setTab(tab: (typeof TABS)[number]['id']): void {
    this.tab.set(tab);
    this.page.set(1);
    void this.list.load();
  }

  protected setStatus(status: string): void {
    this.status.set(status);
    this.page.set(1);
    void this.list.load();
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    void this.list.load();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.list.load();
  }
}
