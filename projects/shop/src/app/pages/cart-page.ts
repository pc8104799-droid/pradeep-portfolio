import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@pc/core';
import { CartService, CatalogService } from '@pc/shop-core';
import { BillSummary } from '../shared/bill-summary';
import { ProductCard } from '../shared/product-card';
import { QtyStepper } from '../shared/qty-stepper';
import { RupeesPipe } from '../shared/rupees.pipe';
import { ToastService } from '../shared/toast.service';

@Component({
  selector: 'shop-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BillSummary, ProductCard, QtyStepper, RupeesPipe],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
})
export class CartPage {
  protected readonly cart = inject(CartService);
  protected readonly catalog = inject(CatalogService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly code = signal('');
  protected readonly couponMessage = signal('');
  protected readonly couponOk = signal(true);

  protected readonly suggestions = computed(() =>
    this.catalog.bestsellers().filter((product) => this.cart.qtyOfProduct(product.id) === 0).slice(0, 6),
  );

  protected readonly coupons = computed(() => this.catalog.coupons());

  protected apply(code?: string): void {
    const result = this.cart.applyCoupon(code ?? this.code());

    this.couponOk.set(result.ok);
    this.couponMessage.set(result.message);

    if (result.ok) {
      this.code.set('');
    }
  }

  protected removeCoupon(): void {
    this.cart.removeCoupon();
    this.couponMessage.set('');
  }

  protected remove(lineId: string, name: string): void {
    const line = this.cart.lines().find((entry) => entry.id === lineId);
    if (!line) {
      return;
    }

    const snapshot = { ...line };
    this.cart.remove(lineId);

    this.toasts.show(`${name} removed`, 'warn', {
      label: 'Undo',
      run: () => this.restore(snapshot),
    });
  }

  /** setQty cannot resurrect a removed line, so put it back explicitly. */
  private restore(line: ReturnType<CartService['lines']>[number]): void {
    const product = this.catalog.product(line.productId);
    const variant = this.catalog.variant(line.productId, line.variantId);

    if (product && variant) {
      this.cart.add(product, variant, line.qty);
    }
  }

  protected async checkout(): Promise<void> {
    if (!this.auth.signedIn()) {
      await this.router.navigate(['/login'], { queryParams: { next: '/checkout' } });
      return;
    }

    await this.router.navigateByUrl('/checkout');
  }
}
