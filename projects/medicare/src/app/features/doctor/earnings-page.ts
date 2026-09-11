import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, lazyState, PaymentService, StatsService } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CHARTS } from '../../shared/ui/charts';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'successful', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'refunded', label: 'Refunded' },
] as const;

/**
 * Consultation earnings.
 *
 * Scoped by the API to this doctor's own consultation payments — a doctor sees
 * what they were paid for a visit, not what the patient spent at the pharmacy.
 * No money is processed anywhere in this project; these are the hospital's
 * records of it.
 */
@Component({
  selector: 'mc-earnings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CHARTS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Earnings</h1>
          <p>Consultation fees recorded against your appointments.</p>
        </div>
      </header>

      <mc-data-state
        [busy]="dashboard.loading()"
        [error]="dashboard.error()"
        [skeletonLines]="3"
        [skeletonHeight]="5"
        errorTitle="Your earnings did not load"
        (retry)="dashboard.load()"
      >
        @if (dashboard.data(); as data) {
          <div class="grid grid--metrics">
            <mc-stat label="Today" [value]="data.earnings.today" [currency]="true" />
            <mc-stat label="This week" [value]="data.earnings.week" [currency]="true" />
            <mc-stat
              label="This month"
              [value]="data.earnings.month"
              [currency]="true"
              [hint]="data.earnings.paidCount + ' paid consultations'"
            />
            <mc-stat
              label="Outstanding"
              [value]="data.earnings.pending"
              [currency]="true"
              [hint]="data.earnings.pendingCount + ' unpaid'"
              tone="warning"
            />
          </div>

          <div class="split">
            <div class="stack">
              <article class="card card--pad">
                <div class="spread">
                  <h2>Revenue by month</h2>
                  <span class="badge">{{ data.earnings.lifetime | inr }} all time</span>
                </div>
                <mc-bar-chart [points]="data.charts.revenue" [currency]="true" caption="Last six months" />
              </article>

              <article class="card card--flush">
                <header class="card__head">
                  <h2>Transactions</h2>

                  <div class="row row--wrap">
                    @for (filter of filters; track filter.id) {
                      <button
                        type="button"
                        class="chip"
                        [class.is-active]="status() === filter.id"
                        (click)="setStatus(filter.id)"
                      >
                        {{ filter.label }}
                      </button>
                    }
                  </div>
                </header>

                <mc-data-state
                  [busy]="payments.loading()"
                  [error]="payments.error()"
                  [empty]="payments.empty()"
                  [skeletonLines]="4"
                  [skeletonHeight]="3"
                  emptyTitle="No transactions in this view"
                  emptyBody="Consultation payments appear here as soon as a patient pays."
                  (retry)="payments.load()"
                >
                  <div class="table-wrap" [class.is-reloading]="payments.reloading()">
                    <table class="data">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Appointment</th>
                          <th>Method</th>
                          <th>Status</th>
                          <th class="right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (payment of payments.data()?.items ?? []; track payment.id) {
                          <tr>
                            <td class="num">{{ (payment.paidAt ?? payment.createdAt) | day: 'short' }}</td>
                            <td>
                              <a class="mono" [routerLink]="['/doctor/appointments', payment.referenceId]">
                                {{ payment.referenceId }}
                              </a>
                              @if (payment.transactionId) {
                                <div class="mono text-xs muted">{{ payment.transactionId }}</div>
                              }
                            </td>
                            <td>{{ payment.method ? (payment.method | label) : '—' }}</td>
                            <td><mc-status [status]="payment.status" /></td>
                            <td class="right num">
                              <strong>{{ payment.amount | inr }}</strong>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  @if (payments.data(); as page) {
                    <div class="pager-wrap">
                      <mc-paginator
                        [page]="page.page"
                        [pages]="page.pages"
                        [total]="page.total"
                        (pageChange)="setPage($event)"
                      />
                    </div>
                  }
                </mc-data-state>
              </article>
            </div>

            <aside class="stack">
              <article class="card card--pad stack--sm">
                <h2>Consultation fees</h2>

                <div class="kv">
                  <div class="kv__row">
                    <span class="kv__key">First visit</span>
                    <span class="kv__value num">{{ auth.doctor()?.consultationFee | inr }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Follow-up</span>
                    <span class="kv__value num">{{ auth.doctor()?.followUpFee | inr }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Average per visit</span>
                    <span class="kv__value num">{{ averageFee() | inr }}</span>
                  </div>
                </div>

                <mc-note tone="info">
                  Fees are set by hospital administration, not from this screen. A follow-up within
                  30 days of a completed visit is priced automatically at the lower rate.
                </mc-note>
              </article>

              <article class="card card--pad stack--sm">
                <h2>How a fee is made up</h2>

                <ul class="breakdown">
                  <li><span>Consultation fee</span><span>base</span></li>
                  <li><span>Hospital service charge</span><span>+5%</span></li>
                  <li><span>GST</span><span>+18%</span></li>
                  <li><span>Insurance co-pay</span><span>−40% where covered</span></li>
                </ul>

                <p class="text-xs muted">
                  The hospital bills the insurer directly for the covered portion, so the amount
                  shown here is what the patient paid.
                </p>
              </article>
            </aside>
          </div>
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    h2 {
      font-size: 0.95rem;
    }

    .right {
      text-align: right;
    }

    .pager-wrap {
      padding: 0.5rem var(--pad-card) var(--pad-card);
    }

    td a {
      color: var(--primary);
      font-weight: 600;
    }

    .breakdown {
      display: grid;
      gap: 0.3rem;
      font-size: 0.86rem;
    }

    .breakdown li {
      display: flex;
      justify-content: space-between;
      gap: var(--gap-sm);
      color: var(--ink-2);
      padding-bottom: 0.3rem;
      border-bottom: 1px solid var(--stroke);
    }

    .breakdown li:last-child {
      border-bottom: 0;
    }
  `,
})
export class EarningsPage {
  protected readonly auth = inject(AuthService);

  private readonly stats = inject(StatsService);
  private readonly paymentService = inject(PaymentService);

  protected readonly filters = FILTERS;
  protected readonly status = signal<string>('');
  protected readonly page = signal(1);

  private readonly doctorId = this.auth.profileId() ?? '';

  protected readonly dashboard = lazyState(() => this.stats.doctor(this.doctorId));

  protected readonly payments = lazyState(() =>
    this.paymentService.list({
      status: this.status(),
      page: this.page(),
      limit: 12,
      sort: '-createdAt',
    }),
  );

  protected readonly averageFee = computed(() => {
    const earnings = this.dashboard.data()?.earnings;
    if (!earnings?.paidCount) return 0;

    return Math.round(earnings.lifetime / earnings.paidCount);
  });

  constructor() {
    void this.dashboard.load();
    void this.payments.load();
  }

  protected setStatus(status: string): void {
    this.status.set(status);
    this.page.set(1);
    void this.payments.load();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.payments.load();
  }
}
