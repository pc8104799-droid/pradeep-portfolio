import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService, CatalogService, type Variant } from '@pc/shop-core';
import { ProductCard } from '../shared/product-card';
import { QtyStepper } from '../shared/qty-stepper';
import { RupeesPipe } from '../shared/rupees.pipe';
import { ToastService } from '../shared/toast.service';

@Component({
  selector: 'shop-product-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductCard, QtyStepper, RupeesPipe],
  templateUrl: './product-page.html',
  styleUrl: './product-page.scss',
})
export class ProductPage {
  protected readonly catalog = inject(CatalogService);
  protected readonly cart = inject(CartService);
  private readonly toasts = inject(ToastService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  protected readonly product = computed(() =>
    this.catalog.product(this.params().get('productId') ?? ''),
  );

  private readonly chosenId = signal<string | null>(null);

  /** The selected variant, defaulting to the cheapest in stock. */
  protected readonly variant = computed<Variant | null>(() => {
    const product = this.product();
    if (!product) {
      return null;
    }

    const chosen = product.variants.find((entry) => entry.id === this.chosenId());
    if (chosen) {
      return chosen;
    }

    const inStock = product.variants.filter((entry) => entry.inStock);
    const pool = inStock.length ? inStock : product.variants;
    return pool.reduce((cheapest, entry) => (entry.price < cheapest.price ? entry : cheapest));
  });

  protected readonly category = computed(() => {
    const product = this.product();
    return product ? (this.catalog.category(product.categoryId) ?? null) : null;
  });

  protected readonly kitchen = computed(() => {
    const product = this.product();
    return product?.kitchenId ? (this.catalog.kitchen(product.kitchenId) ?? null) : null;
  });

  protected readonly related = computed(() => {
    const product = this.product();
    return product ? this.catalog.related(product) : [];
  });

  protected readonly qty = computed(() => {
    const product = this.product();
    const variant = this.variant();
    return product && variant ? this.cart.qtyOf(product.id, variant.id) : 0;
  });

  protected readonly lineId = computed(() => `${this.product()?.id}:${this.variant()?.id}`);

  protected readonly savings = computed(() => {
    const variant = this.variant();
    if (!variant?.mrp || variant.mrp <= variant.price) {
      return null;
    }

    return {
      amount: variant.mrp - variant.price,
      percent: Math.round(((variant.mrp - variant.price) / variant.mrp) * 100),
    };
  });

  constructor() {
    // A different product resets the variant choice.
    effect(() => {
      this.params();
      this.chosenId.set(null);
    });
  }

  protected choose(variantId: string): void {
    this.chosenId.set(variantId);
  }

  protected add(): void {
    const product = this.product();
    const variant = this.variant();

    if (!product || !variant) {
      return;
    }

    const first = this.qty() === 0;
    this.cart.add(product, variant);

    if (first) {
      this.toasts.show(`${product.name} · ${variant.label} added`);
    }
  }
}
