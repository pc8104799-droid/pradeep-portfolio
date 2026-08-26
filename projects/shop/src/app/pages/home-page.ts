import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService, CatalogService, OrderService } from '@pc/shop-core';
import { ProductCard } from '../shared/product-card';
import { RupeesPipe } from '../shared/rupees.pipe';

@Component({
  selector: 'shop-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductCard, RupeesPipe],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  protected readonly catalog = inject(CatalogService);
  protected readonly cart = inject(CartService);
  protected readonly orders = inject(OrderService);

  protected readonly config = computed(() => this.catalog.config());
  protected readonly foodCategories = computed(() => this.catalog.categoriesFor('food'));
  protected readonly groceryCategories = computed(() => this.catalog.categoriesFor('grocery'));

  protected readonly bestFood = computed(() =>
    this.catalog.search({ kind: 'food', bestsellerOnly: true, sort: 'rating' }),
  );

  protected readonly bestGrocery = computed(() =>
    this.catalog.search({ kind: 'grocery', bestsellerOnly: true, sort: 'rating' }),
  );

  protected readonly underNinetyNine = computed(() =>
    this.catalog.search({ maxPrice: 99, sort: 'price-asc' }).slice(0, 8),
  );

  /** Offers worth showing: everything, with what still needs adding to qualify. */
  protected readonly offers = computed(() =>
    this.catalog.coupons().map((coupon) => ({
      ...coupon,
      short: Math.max(0, coupon.minOrder - this.cart.itemTotal()),
    })),
  );

  /** An order still in flight gets a resume strip at the top. */
  protected readonly liveOrder = computed(() => this.orders.active()[0] ?? null);
}
