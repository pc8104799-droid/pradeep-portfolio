import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderService } from '@pc/shop-core';
import { RupeesPipe } from '../shared/rupees.pipe';

@Component({
  selector: 'shop-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RupeesPipe],
  template: `
    <section class="section">
      <div class="shell">
        <header class="head">
          <h1>Your orders</h1>
          @if (orders.orders().length) {
            <button type="button" class="btn btn--ghost btn--sm" (click)="orders.clearHistory()">
              Clear history
            </button>
          }
        </header>

        @if (!orders.orders().length) {
          <div class="card card--pad empty">
            <p class="empty__glyph" aria-hidden="true">📦</p>
            <h2>No orders yet</h2>
            <p class="muted">Your orders will show up here, with live tracking.</p>
            <a class="btn btn--primary" routerLink="/menu">Start an order</a>
          </div>
        } @else {
          <ul class="orders">
            @for (order of orders.orders(); track order.id) {
              <li>
                <a class="order card" [routerLink]="['/order', order.id]">
                  <div class="order__head">
                    <span class="order__id">{{ order.id }}</span>
                    <span
                      class="order__stage"
                      [class.is-live]="order.stage !== 'delivered'"
                    >
                      {{ orders.label(order.stage) }}
                    </span>
                  </div>

                  <p class="order__items">
                    @for (line of order.lines.slice(0, 4); track line.id) {
                      <span aria-hidden="true">{{ line.glyph }}</span>
                    }
                    <span class="muted">
                      {{ order.lines.length }} item{{ order.lines.length === 1 ? '' : 's' }} ·
                      {{ order.lines[0].name }}@if (order.lines.length > 1) { and more}
                    </span>
                  </p>

                  <div class="order__foot">
                    <span class="order__when muted">{{ when(order.placedAt) }}</span>
                    <span class="order__total mono-num">{{ order.bill.total | rupees }}</span>
                  </div>
                </a>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.1rem;
    }

    .empty {
      display: grid;
      justify-items: center;
      gap: .5rem;
      text-align: center;
      padding-block: clamp(2.5rem, 8vw, 4.5rem);
    }

    .empty__glyph {
      font-size: 2.8rem;
    }

    .orders {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: .8rem;
    }

    .order {
      display: grid;
      gap: .6rem;
      height: 100%;
      padding: 1rem;
      transition: transform var(--t) var(--ease-out), box-shadow var(--t) var(--ease-out);
    }

    .order:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }

    .order__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .7rem;
    }

    .order__id {
      font-family: var(--font-display);
      font-size: .92rem;
      font-weight: 700;
    }

    .order__stage {
      padding: .18rem .55rem;
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--ink-2);
      font-size: .72rem;
      font-weight: 700;
    }

    .order__stage.is-live {
      background: var(--accent-soft);
      color: var(--leaf-700);
    }

    .order__items {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .3rem;
      font-size: .84rem;
    }

    .order__items span[aria-hidden] {
      font-size: 1.05rem;
    }

    .order__foot {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      padding-top: .6rem;
      border-top: 1px solid var(--stroke);
    }

    .order__when {
      font-size: .8rem;
    }

    .order__total {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 700;
    }
  `,
})
export class OrdersPage {
  protected readonly orders = inject(OrderService);

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
