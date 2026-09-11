import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lazyState, PaymentService, StatsService } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CHARTS } from '../../shared/ui/charts';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const STATUSES = ['', 'successful', 'pending', 'failed', 'refunded'];
const KINDS = ['', 'consultation', 'pharmacy'];

/**
 * Every transaction in the hospital.
 *
 * The desk's version of the billing screen: consultations and pharmacy orders
 * together, filtered by status, with the unpaid ones reachable in one click.
 * No money is processed here — this is the record of it.
 */
@Component({
  selector: 'mc-admin-payments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_CHARTS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Payments</h1>
          <p>{{ list.data()?.total ?? 0 }} transactions in this view.</p>
        </div>

        <mc-search
          [value]="search()"
          placeholder="Payment, transaction or reference ID"
          (valueChange)="setSearch($event)"
        />
      </header>

      <mc-data-state
        [busy]="stats.loading()"
        [error]="stats.error()"
        [skeletonLines]="1"
        [skeletonHeight]="5"
        errorTitle="Hospital figures did not load"
        (retry)="stats.load()"
      >
        @if (stats.data(); as data) {
          <div class="grid grid--metrics">
            <mc-stat label="Taken today" [value]="data.money.revenueToday" [currency]="true" />
            <mc-stat
              label="This month"
              [value]="data.money.revenueMonth"
              [currency]="true"
              [hint]="data.money.refundedMonth + ' refunds'"
            />
            <mc-stat
              label="Outstanding"
              [value]="data.money.unpaidValue"
              [currency]="true"
              [hint]="data.money.unpaidCount + ' unpaid'"
              [tone]="data.money.unpaidCount ? 'warning' : ''"
            />
            <mc-stat
              label="Pharmacy orders open"
              [value]="data.pharmacy.openOrders"
              hint="Awaiting dispatch"
            />
          </div>

          <article class="card card--pad">
            <div class="spread">
              <h2>Revenue by month</h2>
              <span class="badge">Consultations and pharmacy combined</span>
            </div>
            <mc-bar-chart [points]="data.charts.revenue" [currency]="true" caption="Last six months" />
          </article>
        }
      </mc-data-state>

      <div class="row row--wrap filters">
        <label class="field">
          <span class="sr-only">Status</span>
          <select [ngModel]="status()" (ngModelChange)="setStatus($event)">
            @for (option of statuses; track option) {
              <option [value]="option">{{ option ? (option | label) : 'Any status' }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span class="sr-only">Kind</span>
          <select [ngModel]="kind()" (ngModelChange)="setKind($event)">
            @for (option of kinds; track option) {
              <option [value]="option">{{ option ? (option | label) : 'Consultations & pharmacy' }}</option>
            }
          </select>
        </label>

        @if (visibleTotal(); as total) {
          <span class="text-sm muted total">
            {{ total | inr }} on this page
          </span>
        }
      </div>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="6"
        [skeletonHeight]="3"
        emptyTitle="No transactions match"
        emptyBody="Clear the filters, or search by reference."
        (retry)="list.load()"
      >
        <div class="card card--flush" [class.is-reloading]="list.reloading()">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>For</th>
                  <th>Patient</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th class="right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (payment of list.data()?.items ?? []; track payment.id) {
                  <tr>
                    <td class="num">{{ (payment.paidAt ?? payment.createdAt) | day: 'short' }}</td>
                    <td>
                      <strong>
                        {{ payment.kind === 'consultation' ? 'Consultation' : 'Medicine order' }}
                      </strong>
                      <div class="mono text-xs muted">{{ payment.referenceId }}</div>
                    </td>
                    <td>
                      <a [routerLink]="['/admin/patients', payment.patientId]" class="mono text-sm">
                        {{ payment.patientId }}
                      </a>
                    </td>
                    <td class="text-sm">{{ payment.method ? (payment.method | label) : '—' }}</td>
                    <td>
                      <mc-status [status]="payment.status" />
                      @if (payment.failureReason) {
                        <div class="muted text-xs">{{ payment.failureReason }}</div>
                      }
                    </td>
                    <td class="right num">
                      <strong>{{ payment.amount | inr }}</strong>
                    </td>
                    <td class="cell-actions">
                      @if (payment.status === 'successful' || payment.status === 'refunded') {
                        <a class="btn btn--outline btn--sm" [routerLink]="['/admin/payments', payment.id]">
                          Receipt
                        </a>
                      } @else {
                        <a
                          class="btn btn--ghost btn--sm"
                          [routerLink]="[
                            payment.kind === 'consultation'
                              ? '/admin/appointments'
                              : '/admin/orders',
                            payment.referenceId
                          ]"
                        >
                          Open
                        </a>
                      }
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
    h2 {
      font-size: 0.95rem;
    }

    .right {
      text-align: right;
    }

    .filters {
      gap: var(--gap-sm);
    }

    .filters .field {
      max-width: 14rem;
      min-width: 10rem;
    }

    .total {
      margin-left: auto;
      font-variant-numeric: tabular-nums;
    }

    td a:hover {
      color: var(--primary);
    }
  `,
})
export class AdminPaymentsPage {
  private readonly payments = inject(PaymentService);
  private readonly statsService = inject(StatsService);

  protected readonly statuses = STATUSES;
  protected readonly kinds = KINDS;

  protected readonly status = signal('');
  protected readonly kind = signal('');
  protected readonly search = signal('');
  protected readonly page = signal(1);

  protected readonly stats = lazyState(() => this.statsService.hospital());

  protected readonly list = lazyState(() =>
    this.payments.list({
      q: this.search(),
      status: this.status(),
      kind: this.kind(),
      page: this.page(),
      limit: 15,
      sort: '-createdAt',
    }),
  );

  /** The page total, which is what a desk reconciling a shift actually adds up. */
  protected readonly visibleTotal = computed(() =>
    (this.list.data()?.items ?? [])
      .filter((payment) => payment.status === 'successful')
      .reduce((sum, payment) => sum + payment.amount, 0),
  );

  constructor() {
    void this.stats.load();
    void this.list.load();
  }

  protected setStatus(value: string): void {
    this.status.set(value);
    this.reset();
  }

  protected setKind(value: string): void {
    this.kind.set(value);
    this.reset();
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.reset();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.list.load();
  }

  private reset(): void {
    this.page.set(1);
    void this.list.load();
  }
}
