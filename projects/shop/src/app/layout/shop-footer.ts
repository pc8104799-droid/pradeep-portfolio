import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '@pc/shop-core';

@Component({
  selector: 'shop-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @let config = catalog.config();

    <div class="shell foot">
      <div class="foot__brand">
        <p class="foot__mark">
          <span aria-hidden="true">🥕</span>
          <strong>{{ config.name }}</strong>
        </p>
        <p class="foot__tag">{{ config.tagline }}</p>
        <p class="foot__hours">
          Open daily {{ config.openFrom }} – {{ config.openTo }} ·
          {{ config.serviceAreas.length }} areas served
        </p>
      </div>

      <div class="foot__col">
        <h4>Food</h4>
        <ul>
          @for (category of foodCategories(); track category.id) {
            <li><a [routerLink]="['/menu', category.id]">{{ category.name }}</a></li>
          }
        </ul>
      </div>

      <div class="foot__col">
        <h4>Groceries</h4>
        <ul>
          @for (category of groceryCategories(); track category.id) {
            <li><a [routerLink]="['/menu', category.id]">{{ category.name }}</a></li>
          }
        </ul>
      </div>

      <div class="foot__col">
        <h4>Help</h4>
        <ul>
          <li><a [href]="'mailto:' + config.supportEmail">{{ config.supportEmail }}</a></li>
          <li><a [href]="'tel:' + config.supportPhone.replace(' ', '')">{{ config.supportPhone }}</a></li>
          <li><a routerLink="/orders">Track an order</a></li>
          <li><a routerLink="/account">Your addresses</a></li>
        </ul>
      </div>
    </div>

    <div class="shell foot__legal">
      <p>© {{ year }} {{ config.name }}. Prices include applicable taxes.</p>
      <p class="foot__pay">
        <span>UPI</span><span>Cards</span><span>Cash on delivery</span>
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      margin-top: clamp(2rem, 5vw, 4rem);
      border-top: 1px solid var(--stroke);
      background: var(--bg-2);
    }

    .foot {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr));
      gap: clamp(1.25rem, 3vw, 2.5rem);
      padding-block: clamp(1.75rem, 4vw, 2.75rem);
    }

    .foot__mark {
      display: flex;
      align-items: center;
      gap: .5rem;
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 800;
    }

    .foot__tag,
    .foot__hours {
      color: var(--ink-3);
      font-size: .86rem;
      margin-top: .4rem;
      max-width: 34ch;
    }

    .foot__hours {
      font-size: .8rem;
    }

    h4 {
      font-size: .82rem;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--ink-3);
      margin-bottom: .6rem;
    }

    .foot__col ul {
      display: grid;
      gap: .35rem;
    }

    .foot__col a {
      color: var(--ink-2);
      font-size: .87rem;
    }

    .foot__col a:hover {
      color: var(--leaf-700);
    }

    .foot__legal {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: .6rem 1.5rem;
      padding-block: 1rem 1.25rem;
      border-top: 1px solid var(--stroke);
      color: var(--ink-3);
      font-size: .78rem;
    }

    .foot__pay {
      display: flex;
      gap: .4rem;
    }

    .foot__pay span {
      padding: .2rem .5rem;
      border-radius: 6px;
      border: 1px solid var(--stroke);
      font-size: .7rem;
      font-weight: 600;
    }

    @container page (max-width: 900px) {
      .foot {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 620px) {
      .foot {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ShopFooter {
  protected readonly catalog = inject(CatalogService);
  protected readonly year = new Date().getFullYear();

  protected readonly foodCategories = computed(() => this.catalog.categoriesFor('food'));
  protected readonly groceryCategories = computed(() => this.catalog.categoriesFor('grocery'));
}
