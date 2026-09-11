import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lazyState, PaymentService } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'successful', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
] as const;

/**
 * Billing history.
 *
 * Anything still pending is pulled to the top with a pay button, because an
 * unpaid consultation is an unconfirmed appointment — the one entry in this
 * list that actually needs the patient to do something.
 */
@Component({
  selector: 'mc-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Payments</h1>
          <p>Consultation fees and pharmacy orders, with a receipt for each.</p>
        </div>

        <div class="totals">
          <span class="text-xs muted">Paid to date</span>
          <strong class="num">{{ totalPaid() | inr }}</strong>
        </div>
      </header>

      @if (outstanding().length) {
        <article class="card card--pad card--rail card--warning">
          <h2>{{ outstanding().length }} payment{{ outstanding().length > 1 ? 's' : '' }} outstanding</h2>
          <p class="text-sm">A consultation is only confirmed once its fee is paid.</p>

          <ul class="due">
            @for (payment of outstanding(); track payment.id) {
              <li>
                <div>
                  <strong>{{ payment.amount | inr }}</strong>
                  <span class="muted text-xs">
                    {{ payment.kind | label }} · {{ payment.referenceId }}
                  </span>
                </div>
                <a class="btn btn--primary btn--sm" [routerLink]="['/patient/pay', payment.id]">Pay now</a>
              </li>
            }
          </ul>
        </article>
      }

      <div class="row row--wrap" role="group" aria-label="Filter payments">
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

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="4"
        [skeletonHeight]="3.5"
        emptyTitle="No payments yet"
        emptyBody="Consultation fees and medicine orders will be listed here."
        (retry)="list.load()"
      >
        <div class="card card--flush" [class.is-reloading]="list.reloading()">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>For</th>
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
                      <strong>{{ payment.kind === 'consultation' ? 'Consultation' : 'Medicine order' }}</strong>
                      <div class="mono text-xs muted">{{ payment.referenceId }}</div>
                    </td>
                    <td>{{ payment.method ? (payment.method | label) : '—' }}</td>
                    <td><mc-status [status]="payment.status" /></td>
                    <td class="right num"><strong>{{ payment.amount | inr }}</strong></td>
                    <td class="cell-actions">
                      @if (payment.status === 'pending' || payment.status === 'failed') {
                        <a class="btn btn--primary btn--sm" [routerLink]="['/patient/pay', payment.id]">Pay</a>
                      } @else {
                        <a class="btn btn--outline btn--sm" [routerLink]="['/patient/payments', payment.id]">
                          Receipt
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
    .totals {
      display: grid;
      justify-items: end;
      text-align: right;
    }

    .totals strong {
      font-family: var(--font-display);
      font-size: 1.5rem;
    }

    .due {
      display: grid;
      gap: 0.5rem;
      margin-top: 0.6rem;
    }

    .due li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-sm);
      flex-wrap: wrap;
    }

    .due strong {
      display: block;
      font-family: var(--font-display);
      font-size: 1rem;
    }

    .right {
      text-align: right;
    }
  `,
})
export class PaymentsPage {
  private readonly payments = inject(PaymentService);

  protected readonly filters = FILTERS;
  protected readonly status = signal<string>('');
  protected readonly page = signal(1);

  protected readonly list = lazyState(() =>
    this.payments.list({ status: this.status(), page: this.page(), limit: 12, sort: '-createdAt' }),
  );

  /** Loaded separately so the "outstanding" banner survives a status filter. */
  private readonly all = lazyState(() => this.payments.list({ limit: 200 }));

  protected readonly outstanding = computed(() =>
    (this.all.data()?.items ?? []).filter(
      (payment) => payment.status === 'pending' || payment.status === 'failed',
    ),
  );

  protected readonly totalPaid = computed(() =>
    (this.all.data()?.items ?? [])
      .filter((payment) => payment.status === 'successful')
      .reduce((sum, payment) => sum + payment.amount, 0),
  );

  constructor() {
    void this.list.load();
    void this.all.load();
  }

  protected setStatus(status: string): void {
    this.status.set(status);
    this.page.set(1);
    void this.list.load();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.list.load();
  }
}
