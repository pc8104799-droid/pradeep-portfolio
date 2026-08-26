import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CartService, type Bill } from '@pc/shop-core';
import { RupeesPipe } from './rupees.pipe';

/**
 * The bill breakdown, used on the cart, the checkout and the order pages. Reads
 * a Bill rather than recomputing anything, so a placed order shows exactly the
 * numbers it was charged.
 */
@Component({
  selector: 'shop-bill-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RupeesPipe],
  template: `
    @let b = bill();

    <div class="bill">
      <h3 class="bill__title">{{ title() }}</h3>

      <dl class="bill__rows">
        <div>
          <dt>Item total</dt>
          <dd class="mono-num">{{ b.itemTotal | rupees }}</dd>
        </div>

        @if (b.savedOnMrp > 0) {
          <div class="is-good">
            <dt>Saved on MRP</dt>
            <dd class="mono-num">− {{ b.savedOnMrp | rupees }}</dd>
          </div>
        }

        @if (b.discount > 0) {
          <div class="is-good">
            <dt>Coupon {{ b.couponCode }}</dt>
            <dd class="mono-num">− {{ b.discount | rupees }}</dd>
          </div>
        }

        <div>
          <dt>Delivery</dt>
          <dd class="mono-num">
            @if (b.deliveryFee === 0) {
              <span class="free">FREE</span>
            } @else {
              {{ b.deliveryFee | rupees }}
            }
          </dd>
        </div>

        @if (b.slotSurcharge > 0) {
          <div>
            <dt>Express slot</dt>
            <dd class="mono-num">{{ b.slotSurcharge | rupees }}</dd>
          </div>
        }

        <div>
          <dt>Packaging</dt>
          <dd class="mono-num">{{ b.packagingFee | rupees }}</dd>
        </div>

        <div>
          <dt>GST</dt>
          <dd class="mono-num">{{ b.tax | rupees }}</dd>
        </div>
      </dl>

      <p class="bill__total">
        <span>To pay</span>
        <strong class="mono-num">{{ b.total | rupees }}</strong>
      </p>

      @if (b.savedOnMrp + b.discount > 0) {
        <p class="bill__saved">
          You saved {{ b.savedOnMrp + b.discount | rupees }} on this order.
        </p>
      }

      @if (showFreeDeliveryNudge() && cart.awayFromFreeDelivery() > 0) {
        <p class="bill__nudge">
          Add {{ cart.awayFromFreeDelivery() | rupees }} more for free delivery.
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .bill {
      display: grid;
      gap: .75rem;
    }

    .bill__title {
      font-size: .95rem;
      padding-bottom: .6rem;
      border-bottom: 1px solid var(--stroke);
    }

    .bill__rows {
      display: grid;
      gap: .45rem;
    }

    .bill__rows > div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      font-size: .88rem;
    }

    dt {
      color: var(--ink-2);
    }

    .is-good dt,
    .is-good dd {
      color: var(--leaf-700);
    }

    :root[data-theme="dark"] .is-good dt,
    :root[data-theme="dark"] .is-good dd {
      color: var(--leaf-300);
    }

    .free {
      color: var(--leaf-700);
      font-weight: 700;
      font-size: .78rem;
    }

    .bill__total {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      padding-top: .7rem;
      border-top: 1px dashed var(--stroke-strong);
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 600;
    }

    .bill__total strong {
      font-size: 1.25rem;
    }

    .bill__saved {
      padding: .5rem .7rem;
      border-radius: var(--radius-xs);
      background: var(--accent-soft);
      color: var(--leaf-700);
      font-size: .82rem;
      font-weight: 600;
      text-align: center;
    }

    :root[data-theme="dark"] .bill__saved {
      color: var(--leaf-300);
    }

    .bill__nudge {
      color: var(--carrot-700);
      font-size: .82rem;
    }

    :root[data-theme="dark"] .bill__nudge {
      color: var(--carrot-300);
    }
  `,
})
export class BillSummary {
  readonly bill = input.required<Bill>();
  readonly title = input('Bill details');
  readonly showFreeDeliveryNudge = input(false);

  protected readonly cart = inject(CartService);
}
