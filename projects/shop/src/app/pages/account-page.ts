import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@pc/core';
import { AddressService, CartService, CatalogService, OrderService } from '@pc/shop-core';
import { RupeesPipe } from '../shared/rupees.pipe';

@Component({
  selector: 'shop-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RupeesPipe],
  template: `
    <section class="section">
      <div class="shell account">
        <header class="head">
          <span class="head__avatar">{{ auth.user()?.name?.charAt(0) }}</span>
          <div>
            <h1>{{ auth.user()?.name }}</h1>
            <p class="muted">{{ auth.user()?.email }}</p>
          </div>
          <button type="button" class="btn btn--outline btn--sm" (click)="signOut()">
            Sign out
          </button>
        </header>

        <div class="stats">
          <div class="stat card card--pad">
            <strong class="mono-num">{{ orders.orders().length }}</strong>
            <span class="muted">Orders placed</span>
          </div>
          <div class="stat card card--pad">
            <strong class="mono-num">{{ spent() | rupees }}</strong>
            <span class="muted">Total spent</span>
          </div>
          <div class="stat card card--pad">
            <strong class="mono-num">{{ saved() | rupees }}</strong>
            <span class="muted">Saved on offers</span>
          </div>
          <div class="stat card card--pad">
            <strong class="mono-num">{{ addresses.addresses().length }}</strong>
            <span class="muted">Saved addresses</span>
          </div>
        </div>

        <section class="card card--pad">
          <h2>Saved addresses</h2>

          @if (!addresses.addresses().length) {
            <p class="muted">No addresses yet — you can add one during checkout.</p>
          } @else {
            <ul class="addresses">
              @for (address of addresses.addresses(); track address.id) {
                <li class="addr">
                  <div>
                    <p class="addr__label">{{ address.label }}</p>
                    <p class="addr__name">{{ address.name }} · {{ address.phone }}</p>
                    <p class="muted">
                      {{ address.line1 }}@if (address.line2) {, {{ address.line2 }}},
                      {{ address.city }} {{ address.pincode }}
                    </p>
                  </div>
                  <button type="button" class="addr__remove" (click)="addresses.remove(address.id)">
                    Remove
                  </button>
                </li>
              }
            </ul>
          }
        </section>

        <section class="card card--pad">
          <h2>Recent orders</h2>

          @if (!orders.orders().length) {
            <p class="muted">Nothing yet.</p>
          } @else {
            <ul class="recent">
              @for (order of orders.orders().slice(0, 5); track order.id) {
                <li>
                  <a [routerLink]="['/order', order.id]">{{ order.id }}</a>
                  <span class="muted">{{ orders.label(order.stage) }}</span>
                  <span class="mono-num">{{ order.bill.total | rupees }}</span>
                </li>
              }
            </ul>
            <a class="btn btn--ghost btn--sm" routerLink="/orders">See all orders</a>
          }
        </section>

        <section class="card card--pad">
          <h2>Support</h2>
          <p class="muted">
            Questions about an order? Email
            <a [href]="'mailto:' + catalog.config().supportEmail">
              {{ catalog.config().supportEmail }}
            </a>
            or call {{ catalog.config().supportPhone }}.
          </p>
        </section>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .account {
      max-width: 760px;
      display: grid;
      gap: .9rem;
    }

    .head {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: .3rem;
    }

    .head__avatar {
      display: grid;
      place-items: center;
      width: 54px;
      height: 54px;
      flex: none;
      border-radius: 50%;
      background: var(--grad-brand);
      color: #fff;
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .head h1 {
      font-size: clamp(1.3rem, 3vw, 1.7rem);
    }

    .head .btn {
      margin-left: auto;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: .7rem;
    }

    .stat {
      display: grid;
      gap: .1rem;
    }

    .stat strong {
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 800;
    }

    .stat .muted {
      font-size: .78rem;
    }

    h2 {
      font-size: 1rem;
      margin-bottom: .8rem;
    }

    .addresses {
      display: grid;
      gap: .6rem;
    }

    .addr {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: .75rem .85rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--stroke);
      font-size: .86rem;
    }

    .addr__label {
      display: inline-block;
      padding: .1rem .45rem;
      margin-bottom: .25rem;
      border-radius: 5px;
      background: var(--surface-2);
      font-size: .68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .05em;
    }

    .addr__name {
      font-weight: 600;
    }

    .addr__remove {
      color: var(--ink-3);
      font-size: .78rem;
      text-decoration: underline;
      text-underline-offset: 2px;
      white-space: nowrap;
    }

    .addr__remove:hover {
      color: var(--berry);
    }

    .recent {
      display: grid;
      gap: .4rem;
      margin-bottom: .9rem;
    }

    .recent li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: .7rem;
      align-items: baseline;
      font-size: .87rem;
    }

    .recent a {
      font-family: var(--font-display);
      font-weight: 700;
      color: var(--leaf-700);
    }

    a[href^="mailto"] {
      color: var(--leaf-700);
      font-weight: 600;
    }
  `,
})
export class AccountPage {
  protected readonly auth = inject(AuthService);
  protected readonly addresses = inject(AddressService);
  protected readonly orders = inject(OrderService);
  protected readonly catalog = inject(CatalogService);

  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  protected readonly spent = computed(() =>
    this.orders.orders().reduce((sum, order) => sum + order.bill.total, 0),
  );

  protected readonly saved = computed(() =>
    this.orders
      .orders()
      .reduce((sum, order) => sum + order.bill.discount + order.bill.savedOnMrp, 0),
  );

  protected async signOut(): Promise<void> {
    this.auth.logout();
    this.cart.clear();
    await this.router.navigateByUrl('/');
  }
}
