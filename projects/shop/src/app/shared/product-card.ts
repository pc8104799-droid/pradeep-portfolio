import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService, CatalogService, type Product } from '@pc/shop-core';
import { QtyStepper } from './qty-stepper';
import { RupeesPipe } from './rupees.pipe';
import { ToastService } from './toast.service';

/**
 * One product in a grid or a carousel. Adds the cheapest in-stock variant
 * directly; anything with a real choice to make sends the shopper to the
 * product page instead.
 */
@Component({
  selector: 'shop-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, QtyStepper, RupeesPipe],
  template: `
    @let item = product();
    @let variant = defaultVariant();

    <article class="pc">
      <a class="pc__media" [routerLink]="['/product', item.id]" [attr.aria-label]="item.name">
        <span
          class="pc__glyph"
          [style.--a1]="accent()[0]"
          [style.--a2]="accent()[1]"
          aria-hidden="true"
        >{{ item.glyph }}</span>

        @if (discount() > 0) {
          <span class="badge badge--save pc__save">{{ discount() }}% off</span>
        }
        @if (item.bestseller) {
          <span class="badge badge--best pc__best">Bestseller</span>
        }
      </a>

      <div class="pc__body">
        <div class="pc__head">
          <span class="diet" [class]="'diet diet--' + item.diet" [attr.title]="item.diet"></span>
          <span class="pc__rating">★ {{ item.rating }}</span>
        </div>

        <a class="pc__name" [routerLink]="['/product', item.id]">{{ item.name }}</a>
        <p class="pc__meta">{{ variant.label }}</p>

        <div class="pc__foot">
          <span class="pc__price">
            <strong>{{ variant.price | rupees }}</strong>
            @if (variant.mrp) {
              <s>{{ variant.mrp | rupees }}</s>
            }
          </span>

          <shop-qty-stepper
            [qty]="qty()"
            [disabled]="!variant.inStock"
            [label]="item.name"
            (added)="add()"
            (incremented)="add()"
            (decremented)="cart.decrement(lineId())"
          />
        </div>
      </div>
    </article>
  `,
  styleUrl: './product-card.scss',
})
export class ProductCard {
  readonly product = input.required<Product>();

  protected readonly catalog = inject(CatalogService);
  protected readonly cart = inject(CartService);
  private readonly toasts = inject(ToastService);

  /** Cheapest in-stock variant, falling back to the first when all are out. */
  protected readonly defaultVariant = computed(() => {
    const variants = this.product().variants;
    const inStock = variants.filter((variant) => variant.inStock);
    const pool = inStock.length ? inStock : variants;

    return pool.reduce((cheapest, variant) =>
      variant.price < cheapest.price ? variant : cheapest,
    );
  });

  protected readonly lineId = computed(() => `${this.product().id}:${this.defaultVariant().id}`);
  protected readonly qty = computed(() =>
    this.cart.qtyOf(this.product().id, this.defaultVariant().id),
  );

  protected readonly discount = computed(() => this.catalog.discountPercent(this.product()));

  protected readonly accent = computed(
    () => this.catalog.category(this.product().categoryId)?.accent ?? ['#22a556', '#7fdca2'],
  );

  protected add(): void {
    const variant = this.defaultVariant();
    const wasEmpty = this.qty() === 0;

    this.cart.add(this.product(), variant);

    if (wasEmpty) {
      this.toasts.show(`${this.product().name} added`);
    }
  }
}
