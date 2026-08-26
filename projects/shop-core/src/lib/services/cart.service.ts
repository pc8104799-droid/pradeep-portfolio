import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Bill, CartLine, Coupon, DeliverySlot, Product, Variant } from '../models/shop.models';
import { CatalogService } from './catalog.service';

const STORAGE_KEY = 'freshkart-cart';

/** Rupees, rounded to paise so totals never drift. */
const money = (value: number): number => Math.round(value * 100) / 100;

interface StoredCart {
  readonly lines: CartLine[];
  readonly couponCode: string | null;
  readonly slotId: string | null;
}

/**
 * The cart, and the single implementation of the bill.
 *
 * Every rupee the customer sees — item total, MRP saving, coupon discount,
 * delivery, packaging, slot surcharge, GST — is derived here, so the cart page,
 * the checkout summary and the stored order can never disagree.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly catalog = inject(CatalogService);

  private readonly _lines = signal<CartLine[]>([]);
  private readonly _couponCode = signal<string | null>(null);
  private readonly _slotId = signal<string | null>(null);

  readonly lines = this._lines.asReadonly();
  readonly couponCode = this._couponCode.asReadonly();

  readonly count = computed(() => this._lines().reduce((sum, line) => sum + line.qty, 0));
  readonly isEmpty = computed(() => this._lines().length === 0);

  readonly slot = computed<DeliverySlot>(() => {
    const slots = this.catalog.slots();
    return slots.find((entry) => entry.id === this._slotId()) ?? slots[1] ?? slots[0];
  });

  /** The applied coupon, or null when the code no longer qualifies. */
  readonly coupon = computed<Coupon | null>(() => {
    const code = this._couponCode();
    if (!code) {
      return null;
    }

    const coupon = this.catalog.coupons().find((entry) => entry.code === code) ?? null;
    return coupon && this.itemTotal() >= coupon.minOrder ? coupon : null;
  });

  readonly itemTotal = computed(() =>
    money(this._lines().reduce((sum, line) => sum + line.unitPrice * line.qty, 0)),
  );

  readonly bill = computed<Bill>(() => {
    const config = this.catalog.config();
    const lines = this._lines();
    const itemTotal = this.itemTotal();
    const coupon = this.coupon();

    const mrpTotal = money(
      lines.reduce((sum, line) => sum + (line.mrp ?? line.unitPrice) * line.qty, 0),
    );

    let discount = 0;
    // An empty cart owes nothing at all, not even the delivery fee.
    let deliveryFee =
      !lines.length || itemTotal >= config.freeDeliveryOver ? 0 : config.deliveryFee;

    if (coupon) {
      if (coupon.kind === 'percent') {
        discount = money(Math.min((itemTotal * coupon.value) / 100, coupon.maxDiscount ?? Infinity));
      } else if (coupon.kind === 'flat') {
        discount = money(Math.min(coupon.value, itemTotal));
      } else {
        deliveryFee = 0;
      }
    }

    const packagingFee = lines.length ? config.packagingFee : 0;
    const slotSurcharge = lines.length ? this.slot().surcharge : 0;
    // GST applies to the discounted goods value, not to fees.
    const tax = money(((itemTotal - discount) * config.taxPercent) / 100);

    return {
      itemTotal,
      mrpTotal,
      savedOnMrp: money(Math.max(0, mrpTotal - itemTotal)),
      discount,
      deliveryFee,
      packagingFee,
      slotSurcharge,
      tax,
      total: money(itemTotal - discount + deliveryFee + packagingFee + slotSurcharge + tax),
      couponCode: coupon?.code ?? null,
    };
  });

  /** Everything saved off MRP plus any coupon — the "you saved" line. */
  readonly totalSaved = computed(() => money(this.bill().savedOnMrp + this.bill().discount));

  constructor() {
    this.restore();

    effect(() => {
      const snapshot: StoredCart = {
        lines: this._lines(),
        couponCode: this._couponCode(),
        slotId: this._slotId(),
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Private mode: the cart simply will not survive a refresh.
      }
    });
  }

  /** Quantity of one sellable unit, used by the stepper on cards. */
  qtyOf(productId: string, variantId: string): number {
    return this._lines().find((line) => line.id === `${productId}:${variantId}`)?.qty ?? 0;
  }

  qtyOfProduct(productId: string): number {
    return this._lines()
      .filter((line) => line.productId === productId)
      .reduce((sum, line) => sum + line.qty, 0);
  }

  add(product: Product, variant: Variant, qty = 1): void {
    if (!variant.inStock) {
      return;
    }

    const id = `${product.id}:${variant.id}`;
    const existing = this._lines().find((line) => line.id === id);

    if (existing) {
      this.setQty(id, existing.qty + qty);
      return;
    }

    this._lines.update((lines) => [
      ...lines,
      {
        id,
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        variantLabel: variant.label,
        glyph: product.glyph,
        unitPrice: variant.price,
        ...(variant.mrp ? { mrp: variant.mrp } : {}),
        qty,
        kind: product.kind,
      },
    ]);
  }

  /** Setting a quantity of zero or less removes the line. */
  setQty(lineId: string, qty: number): void {
    if (qty <= 0) {
      this.remove(lineId);
      return;
    }

    this._lines.update((lines) =>
      lines.map((line) => (line.id === lineId ? { ...line, qty: Math.min(qty, 20) } : line)),
    );
  }

  increment(lineId: string): void {
    const line = this._lines().find((entry) => entry.id === lineId);
    if (line) {
      this.setQty(lineId, line.qty + 1);
    }
  }

  decrement(lineId: string): void {
    const line = this._lines().find((entry) => entry.id === lineId);
    if (line) {
      this.setQty(lineId, line.qty - 1);
    }
  }

  remove(lineId: string): void {
    this._lines.update((lines) => lines.filter((line) => line.id !== lineId));
  }

  clear(): void {
    this._lines.set([]);
    this._couponCode.set(null);
  }

  chooseSlot(slotId: string): void {
    this._slotId.set(slotId);
  }

  /**
   * Applies a code. Returns why it failed rather than throwing, because this is
   * routine user input, not an exceptional condition.
   */
  applyCoupon(code: string): { ok: boolean; message: string } {
    const wanted = code.trim().toUpperCase();

    if (!wanted) {
      return { ok: false, message: 'Enter a coupon code.' };
    }

    const coupon = this.catalog.coupons().find((entry) => entry.code === wanted);
    if (!coupon) {
      return { ok: false, message: `${wanted} is not a valid code.` };
    }

    if (this.itemTotal() < coupon.minOrder) {
      const short = money(coupon.minOrder - this.itemTotal());
      return { ok: false, message: `Add ₹${short} more to use ${wanted}.` };
    }

    this._couponCode.set(wanted);
    return { ok: true, message: `${coupon.label} applied.` };
  }

  removeCoupon(): void {
    this._couponCode.set(null);
  }

  /** Coupons this cart already qualifies for, for the suggestion list. */
  eligibleCoupons(): Coupon[] {
    return this.catalog.coupons().filter((coupon) => this.itemTotal() >= coupon.minOrder);
  }

  /** How much more is needed for free delivery, or 0 when it is already free. */
  awayFromFreeDelivery(): number {
    const target = this.catalog.config().freeDeliveryOver;
    return money(Math.max(0, target - this.itemTotal()));
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const stored = JSON.parse(raw) as StoredCart;
      if (Array.isArray(stored.lines)) {
        this._lines.set(stored.lines);
      }
      this._couponCode.set(stored.couponCode ?? null);
      this._slotId.set(stored.slotId ?? null);
    } catch {
      // A corrupt cart is not worth surfacing; start empty.
    }
  }
}
