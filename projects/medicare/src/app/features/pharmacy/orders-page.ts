import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lazyState, PharmacyService } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const STAGES = [
  { id: '', label: 'All' },
  { id: 'placed', label: 'Placed' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'out-for-delivery', label: 'On the way' },
  { id: 'delivered', label: 'Delivered' },
] as const;

/** Medicine orders, newest first, with their progress on each row. */
@Component({
  selector: 'mc-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Medicine orders</h1>
          <p>Everything ordered from the hospital pharmacy, and where each one has got to.</p>
        </div>

        <a class="btn btn--primary" routerLink="/patient/pharmacy">Order medicines</a>
      </header>

      <div class="row row--wrap" role="group" aria-label="Filter by stage">
        @for (option of stages; track option.id) {
          <button
            type="button"
            class="chip"
            [class.is-active]="stage() === option.id"
            (click)="setStage(option.id)"
          >
            {{ option.label }}
          </button>
        }
      </div>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="3"
        [skeletonHeight]="6"
        emptyTitle="No orders yet"
        emptyBody="Order from the store, or turn a prescription into a basket in one click."
        (retry)="list.load()"
      >
        <div slot="empty-action">
          <a class="btn btn--primary" routerLink="/patient/pharmacy">Browse the store</a>
        </div>

        <div class="stack--sm" [class.is-reloading]="list.reloading()">
          @for (order of list.data()?.items ?? []; track order.id) {
            <article class="order card card--pad">
              <header class="order__head">
                <div>
                  <strong class="mono">{{ order.id }}</strong>
                  <span class="muted text-xs">Placed {{ order.placedAt | when }}</span>
                </div>

                <div class="row row--wrap">
                  <mc-status [status]="order.stage" />
                  <mc-status [status]="order.paymentStatus" [text]="'Payment ' + order.paymentStatus" />
                </div>
              </header>

              <ul class="order__items">
                @for (line of order.lines.slice(0, 3); track line.medicineId) {
                  <li>
                    {{ line.name }}
                    <span class="muted text-xs">× {{ line.quantity }}</span>
                  </li>
                }
                @if (order.lines.length > 3) {
                  <li class="muted">+ {{ order.lines.length - 3 }} more</li>
                }
              </ul>

              <!-- Progress rail: the stage a delivered order reached, at a glance. -->
              <div class="order__rail" [attr.aria-label]="'Stage: ' + order.stage">
                @for (step of railFor(order.stage); track step.label) {
                  <span class="rail__step" [class.is-done]="step.done" [title]="step.label"></span>
                }
              </div>

              <footer class="order__foot">
                <div>
                  <strong class="num">{{ order.bill.total | inr }}</strong>
                  <span class="muted text-xs"> · {{ order.deliverySlot }}</span>
                </div>

                <div class="row row--wrap">
                  @if (order.paymentStatus === 'pending') {
                    <a class="btn btn--primary btn--sm" [routerLink]="['/patient/pay', order.paymentId]">
                      Pay now
                    </a>
                  }
                  <a class="btn btn--outline btn--sm" [routerLink]="['/patient/pharmacy/orders', order.id]">
                    Track order
                  </a>
                </div>
              </footer>
            </article>
          }
        </div>

        @if (list.data(); as page) {
          <mc-paginator [page]="page.page" [pages]="page.pages" [total]="page.total" (pageChange)="setPage($event)" />
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    .order {
      display: grid;
      gap: 0.65rem;
    }

    .order__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--gap-sm);
      flex-wrap: wrap;
    }

    .order__head strong {
      display: block;
      font-size: 0.92rem;
    }

    .order__items {
      display: flex;
      gap: 0.9rem;
      flex-wrap: wrap;
      font-size: 0.86rem;
      color: var(--ink-2);
    }

    .order__rail {
      display: flex;
      gap: 0.25rem;
    }

    .rail__step {
      flex: 1;
      height: 4px;
      border-radius: 2px;
      background: var(--surface-3);
      transition: background var(--t) var(--ease);
    }

    .rail__step.is-done {
      background: var(--primary);
    }

    .order__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-sm);
      flex-wrap: wrap;
      padding-top: 0.55rem;
      border-top: 1px solid var(--stroke);
    }

    .order__foot strong {
      font-family: var(--font-display);
      font-size: 1.05rem;
    }
  `,
})
export class OrdersPage {
  private readonly pharmacy = inject(PharmacyService);

  protected readonly stages = STAGES;
  protected readonly stage = signal<string>('');
  protected readonly page = signal(1);

  protected readonly list = lazyState(() =>
    this.pharmacy.orders({ stage: this.stage(), page: this.page(), limit: 10, sort: '-placedAt' }),
  );

  constructor() {
    void this.list.load();
  }

  protected setStage(stage: string): void {
    this.stage.set(stage);
    this.page.set(1);
    void this.list.load();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.list.load();
  }

  /** The five delivery steps, marked up to the stage this order has reached. */
  protected railFor(stage: string) {
    const steps = ['placed', 'confirmed', 'preparing', 'out-for-delivery', 'delivered'];
    const reached = steps.indexOf(stage);

    return steps.map((label, index) => ({ label, done: stage !== 'cancelled' && index <= reached }));
  }
}
