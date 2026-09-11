import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ApiService, type QueryInput } from '../api/api.service';
import type {
  BasketQuote,
  CartLine,
  Medicine,
  MedicineOrder,
  Page,
  Payment,
  Prescription,
  PrescriptionBasket,
} from '../models/medicare.models';

const CART_KEY = 'medicare360-cart';
const MAX_QUANTITY = 10;

/**
 * The medical store: the basket, and the orders it turns into.
 *
 * The basket holds ids and quantities only — never a price. Totals come from
 * `quote()`, which prices the basket on the server, so a stale price in this
 * browser can never become the amount charged. It is also why a medicine going
 * out of stock shows up as soon as the cart is re-quoted.
 */
@Injectable({ providedIn: 'root' })
export class PharmacyService {
  private readonly api = inject(ApiService);

  private readonly _lines = signal<readonly CartLine[]>(restore());
  /** The prescription attached to the basket, unlocking Rx-only medicines. */
  private readonly _prescriptionId = signal<string | null>(null);
  private readonly _couponCode = signal<string>('');

  readonly lines = this._lines.asReadonly();
  readonly prescriptionId = this._prescriptionId.asReadonly();
  readonly couponCode = this._couponCode.asReadonly();

  readonly count = computed(() => this._lines().reduce((sum, line) => sum + line.quantity, 0));
  readonly isEmpty = computed(() => this._lines().length === 0);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(this._lines()));
      } catch {
        // The basket simply will not survive a refresh.
      }
    });
  }

  /* ------------------------------------------------------------ basket */

  quantityOf(medicineId: string): number {
    return this._lines().find((line) => line.medicineId === medicineId)?.quantity ?? 0;
  }

  add(medicineId: string, quantity = 1): void {
    this._lines.update((lines) => {
      const existing = lines.find((line) => line.medicineId === medicineId);

      if (!existing) return [...lines, { medicineId, quantity: clamp(quantity) }];

      return lines.map((line) =>
        line.medicineId === medicineId ? { ...line, quantity: clamp(line.quantity + quantity) } : line,
      );
    });
  }

  setQuantity(medicineId: string, quantity: number): void {
    if (quantity <= 0) return this.remove(medicineId);

    this._lines.update((lines) =>
      lines.map((line) =>
        line.medicineId === medicineId ? { ...line, quantity: clamp(quantity) } : line,
      ),
    );
  }

  remove(medicineId: string): void {
    this._lines.update((lines) => lines.filter((line) => line.medicineId !== medicineId));
  }

  clear(): void {
    this._lines.set([]);
    this._prescriptionId.set(null);
    this._couponCode.set('');
  }

  attachPrescription(prescriptionId: string | null): void {
    this._prescriptionId.set(prescriptionId);
  }

  applyCoupon(code: string): void {
    this._couponCode.set(code.trim().toUpperCase());
  }

  /** Replaces the basket with every stocked line from a prescription. */
  loadPrescription(basket: PrescriptionBasket): void {
    this._lines.set(basket.lines.map((line) => ({ medicineId: line.medicineId, quantity: 1 })));
    this._prescriptionId.set(basket.prescriptionId);
  }

  /* ------------------------------------------------------------ server */

  /** Prices the current basket. The cart screen calls this on every change. */
  quote(): Promise<BasketQuote> {
    return this.api.post('/pharmacy/quote', {
      lines: this._lines(),
      couponCode: this._couponCode(),
      prescriptionId: this._prescriptionId() ?? '',
    });
  }

  place(addressId: string, deliverySlot: string): Promise<{ order: MedicineOrder; payment: Payment }> {
    return this.api.post('/pharmacy/orders', {
      lines: this._lines(),
      addressId,
      deliverySlot,
      couponCode: this._couponCode(),
      prescriptionId: this._prescriptionId() ?? '',
    });
  }

  orders(query?: QueryInput): Promise<Page<MedicineOrder>> {
    return this.api.get('/pharmacy/orders', query);
  }

  order(id: string): Promise<MedicineOrder> {
    return this.api.get(`/pharmacy/orders/${id}`);
  }

  advanceOrder(id: string): Promise<MedicineOrder> {
    return this.api.post(`/pharmacy/orders/${id}/advance`);
  }

  cancelOrder(id: string): Promise<MedicineOrder> {
    return this.api.post(`/pharmacy/orders/${id}/cancel`);
  }

  /** Turns a prescription into a priced basket — the "order these" button. */
  fromPrescription(prescriptionId: string): Promise<PrescriptionBasket> {
    return this.api.get(`/pharmacy/from-prescription/${prescriptionId}`);
  }

  /** Checks a typed or scanned prescription id before it unlocks a basket. */
  verifyPrescription(
    prescriptionId: string,
  ): Promise<{ valid: boolean; reason: string | null; ageDays: number; prescription: Prescription }> {
    return this.api.post('/pharmacy/verify-prescription', { prescriptionId });
  }

  /** Convenience for the catalogue card's "out of stock" badge. */
  static isBuyable(medicine: Medicine, hasPrescription: boolean): boolean {
    if (medicine.stock <= 0) return false;
    return !medicine.prescriptionRequired || hasPrescription;
  }
}

function clamp(quantity: number): number {
  return Math.max(1, Math.min(MAX_QUANTITY, Math.trunc(quantity)));
}

function restore(): readonly CartLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as CartLine[];

    // Drop anything malformed rather than letting one bad row break the cart.
    return Array.isArray(parsed)
      ? parsed.filter((line) => typeof line?.medicineId === 'string' && line.quantity > 0)
      : [];
  } catch {
    return [];
  }
}
