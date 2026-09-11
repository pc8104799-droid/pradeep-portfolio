import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ActionState,
  lazyState,
  PharmacyService,
  ToastService,
  type BasketQuote,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * The basket.
 *
 * Every total on this page comes back from the server: the basket holds ids and
 * quantities, `quote()` prices them. That is what keeps a stale price in this
 * tab from ever becoming the amount charged, and it is why a medicine going out
 * of stock or a prescription expiring shows up here immediately rather than at
 * checkout.
 */
@Component({
  selector: 'mc-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
})
export class CartPage {
  protected readonly cart = inject(PharmacyService);

  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly action = new ActionState();
  protected readonly coupon = signal('');

  protected readonly quote = lazyState<BasketQuote | null>(async () =>
    this.cart.isEmpty() ? null : this.cart.quote(),
  );

  protected readonly hasProblems = computed(() => {
    const quote = this.quote.data();
    return !!quote && (quote.blocked.length > 0 || quote.outOfStock.length > 0);
  });

  constructor() {
    this.coupon.set(this.cart.couponCode());
    void this.quote.load();
  }

  protected setQuantity(medicineId: string, quantity: number): void {
    this.cart.setQuantity(medicineId, quantity);
    void this.quote.load();
  }

  protected remove(medicineId: string, name: string): void {
    this.cart.remove(medicineId);
    this.toasts.info(`${name} removed`);
    void this.quote.load();
  }

  protected clear(): void {
    this.cart.clear();
    this.coupon.set('');
    void this.quote.load();
  }

  protected applyCoupon(): void {
    this.cart.applyCoupon(this.coupon());
    void this.quote.load();
  }

  protected detachPrescription(): void {
    this.cart.attachPrescription(null);
    void this.quote.load();
  }

  /** Drops the lines the server refused, so checkout can proceed. */
  protected removeBlocked(): void {
    const quote = this.quote.data();
    if (!quote) return;

    for (const line of [...quote.blocked, ...quote.outOfStock]) this.cart.remove(line.medicineId);

    void this.quote.load();
    this.toasts.info('Unavailable items removed');
  }

  protected async checkout(): Promise<void> {
    if (this.hasProblems()) {
      this.toasts.warning('Some items cannot be ordered', 'Remove them or attach a prescription.');
      return;
    }

    await this.router.navigateByUrl('/patient/pharmacy/checkout');
  }
}
