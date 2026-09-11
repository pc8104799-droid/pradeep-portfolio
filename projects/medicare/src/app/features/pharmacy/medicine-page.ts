import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService, PharmacyService, ToastService, trackedState } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * One medicine.
 *
 * Written the way a pharmacist would explain it: what it is, what it is for,
 * the strength and form, whether it needs a prescription, and when it expires.
 * The related list is same-category, so a patient can find an alternative when
 * something is out of stock.
 */
@Component({
  selector: 'mc-medicine-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <mc-data-state
        [busy]="medicine.loading()"
        [error]="medicine.error()"
        [skeletonLines]="2"
        [skeletonHeight]="8"
        errorTitle="That medicine could not be loaded"
        (retry)="medicine.load()"
      >
        @if (medicine.data(); as item) {
          <header class="page__head">
            <div>
              <h1>{{ item.name }}</h1>
              <p>{{ item.genericName }} · {{ item.manufacturer }}</p>
            </div>

            <a class="btn btn--outline" routerLink="/patient/pharmacy">← Medical store</a>
          </header>

          <div class="split">
            <div class="stack">
              <article class="card card--pad stack--sm">
                <div class="row row--wrap">
                  <span class="badge badge--primary">{{ item.categoryName }}</span>
                  <span class="badge">{{ item.strength }}</span>
                  <span class="badge">{{ item.form }}</span>
                  @if (item.prescriptionRequired) {
                    <span class="badge badge--warning">Prescription only</span>
                  } @else {
                    <span class="badge badge--success">Over the counter</span>
                  }
                </div>

                <p>{{ item.description }}</p>

                <div class="kv">
                  <div class="kv__row">
                    <span class="kv__key">Generic name</span>
                    <span class="kv__value">{{ item.genericName }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Brand</span>
                    <span class="kv__value">{{ item.brand }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Manufacturer</span>
                    <span class="kv__value">{{ item.manufacturer }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Pack</span>
                    <span class="kv__value">{{ item.packSize }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Expires</span>
                    <span class="kv__value">{{ item.expiryDate | day }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Rating</span>
                    <span class="kv__value">★ {{ item.rating }} · {{ item.ratingCount }} ratings</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Medicine ID</span>
                    <span class="kv__value mono">{{ item.id }}</span>
                  </div>
                </div>
              </article>

              @if (item.prescriptionRequired) {
                <mc-note tone="warning">
                  This medicine is dispensed only against a valid prescription. Attach one from
                  <a routerLink="/patient/prescriptions">your prescriptions</a> before ordering —
                  the pharmacy verifies it at checkout.
                </mc-note>
              }

              @if (item.related?.length) {
                <article class="card card--flush">
                  <header class="card__head"><h2>Others in {{ item.categoryName }}</h2></header>

                  <ul class="related">
                    @for (other of item.related!; track other.id) {
                      <li>
                        <a [routerLink]="['/patient/pharmacy', other.id]">
                          <div>
                            <strong>{{ other.name }}</strong>
                            <span class="muted text-xs">{{ other.strength }} · {{ other.form }}</span>
                          </div>
                          <div class="row">
                            <strong class="num">{{ other.price | inr }}</strong>
                            @if (other.stock === 0) {
                              <span class="badge badge--danger">Out of stock</span>
                            }
                          </div>
                        </a>
                      </li>
                    }
                  </ul>
                </article>
              }
            </div>

            <aside class="stack">
              <article class="card card--pad buy">
                <div class="buy__price">
                  <strong class="num">{{ item.price | inr }}</strong>
                  @if (item.mrp > item.price) {
                    <s class="muted num">{{ item.mrp | inr }}</s>
                    <span class="badge badge--success">{{ item.discount }}% off</span>
                  }
                </div>

                <span class="muted text-sm">{{ item.packSize }} · inclusive of all taxes</span>

                @if (item.stock === 0) {
                  <mc-note tone="danger">
                    Out of stock at the hospital pharmacy. Check the alternatives below.
                  </mc-note>
                } @else if (item.prescriptionRequired && !cart.prescriptionId()) {
                  <mc-note tone="warning">A prescription is needed before this can be ordered.</mc-note>
                  <a class="btn btn--outline btn--block" routerLink="/patient/prescriptions">
                    Attach a prescription
                  </a>
                } @else if (inBasket(); as quantity) {
                  <div class="buy__qty">
                    <mc-qty
                      [value]="quantity"
                      [max]="maxQuantity()"
                      [label]="item.name"
                      (valueChange)="cart.setQuantity(item.id, $event)"
                    />
                    <span class="muted text-sm">in your basket</span>
                  </div>
                  <a class="btn btn--primary btn--block" routerLink="/patient/pharmacy/cart">
                    Go to basket
                  </a>
                } @else {
                  <button type="button" class="btn btn--primary btn--block btn--lg" (click)="add()">
                    Add to basket
                  </button>
                  <span class="muted text-xs">{{ item.stock }} units in stock</span>
                }
              </article>

              <article class="card card--pad stack--sm">
                <h2>Delivery</h2>
                <p class="text-sm muted">
                  Free delivery over ₹499, otherwise ₹49. Same-day slots for orders placed before
                  4 pm. Collection from the pharmacy counter is always free.
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

    .note a {
      color: inherit;
      text-decoration: underline;
      font-weight: 600;
    }

    .related li a {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-sm);
      padding: 0.6rem var(--pad-card);
      border-bottom: 1px solid var(--stroke);
    }

    .related li:last-child a {
      border-bottom: 0;
    }

    .related li a:hover {
      background: var(--surface-2);
    }

    .related strong {
      display: block;
      font-size: 0.88rem;
    }

    .buy {
      display: grid;
      gap: 0.6rem;
      align-content: start;
    }

    .buy__price {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .buy__price strong {
      font-family: var(--font-display);
      font-size: 1.9rem;
      line-height: 1;
    }

    .buy__qty {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    @media (min-width: 1080px) {
      aside {
        position: sticky;
        top: calc(var(--header-h) + 1rem);
      }
    }
  `,
})
export class MedicinePage {
  readonly medicineId = input.required<string>();

  protected readonly cart = inject(PharmacyService);

  private readonly catalog = inject(CatalogService);
  private readonly toasts = inject(ToastService);

  protected readonly medicine = trackedState(
    () => this.medicineId(),
    () => this.catalog.medicine(this.medicineId()),
  );

  protected readonly inBasket = computed(() => this.cart.quantityOf(this.medicineId()));

  /** Never offer more than the pharmacy actually holds. */
  protected readonly maxQuantity = computed(() =>
    Math.min(10, this.medicine.data()?.stock ?? 10),
  );

  protected add(): void {
    const item = this.medicine.data();
    if (!item) return;

    this.cart.add(item.id);
    this.toasts.success(`${item.name} added`, `${this.cart.count()} items in your basket`, {
      label: 'View basket',
      link: '/patient/pharmacy/cart',
    });
  }
}
