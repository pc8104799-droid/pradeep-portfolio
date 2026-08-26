/** Domain types for the storefront. Everything here mirrors catalog.json. */

export type ProductKind = 'food' | 'grocery';
export type DietTag = 'veg' | 'non-veg' | 'egg';

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly kind: ProductKind;
  /** Emoji used as the tile glyph — keeps the app free of image requests. */
  readonly glyph: string;
  /** Two hex stops for the tile gradient. */
  readonly accent: readonly [string, string];
  readonly blurb: string;
}

/** A sellable size or portion of a product. */
export interface Variant {
  readonly id: string;
  /** "500 g", "1 kg", "Regular", "Family pack". */
  readonly label: string;
  readonly price: number;
  /** Struck-through reference price. Omitted when there is no discount. */
  readonly mrp?: number;
  readonly inStock: boolean;
}

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly categoryId: string;
  readonly kind: ProductKind;
  readonly kitchenId?: string;
  readonly glyph: string;
  readonly summary: string;
  readonly description: string;
  readonly diet: DietTag;
  readonly rating: number;
  readonly ratingCount: number;
  /** Minutes to prepare, for food. */
  readonly prepMinutes?: number;
  readonly tags: readonly string[];
  readonly variants: readonly Variant[];
  readonly bestseller: boolean;
}

/** A restaurant or a farm/supplier the product comes from. */
export interface Kitchen {
  readonly id: string;
  readonly name: string;
  readonly kind: ProductKind;
  readonly glyph: string;
  readonly cuisine: string;
  readonly rating: number;
  readonly etaMinutes: number;
  readonly area: string;
  readonly veg: boolean;
}

export type CouponKind = 'percent' | 'flat' | 'free-delivery';

export interface Coupon {
  readonly code: string;
  readonly kind: CouponKind;
  /** Percent (0-100) or rupees, depending on `kind`. */
  readonly value: number;
  readonly minOrder: number;
  /** Rupee ceiling on a percentage discount. */
  readonly maxDiscount?: number;
  readonly label: string;
  readonly terms: string;
}

export interface DeliverySlot {
  readonly id: string;
  readonly label: string;
  readonly window: string;
  /** Extra charge for an express slot. */
  readonly surcharge: number;
}

export interface StoreConfig {
  readonly name: string;
  readonly tagline: string;
  readonly supportEmail: string;
  readonly supportPhone: string;
  /** Payee address for the UPI QR — this is what the QR actually pays. */
  readonly upiId: string;
  readonly upiPayeeName: string;
  readonly currency: string;
  readonly currencySymbol: string;
  readonly freeDeliveryOver: number;
  readonly deliveryFee: number;
  readonly packagingFee: number;
  /** GST percentage applied to the item total. */
  readonly taxPercent: number;
  readonly serviceAreas: readonly string[];
  readonly openFrom: string;
  readonly openTo: string;
}

export interface Catalog {
  readonly config: StoreConfig;
  readonly categories: readonly Category[];
  readonly kitchens: readonly Kitchen[];
  readonly products: readonly Product[];
  readonly coupons: readonly Coupon[];
  readonly slots: readonly DeliverySlot[];
}

/* ----------------------------------------------------------------- cart */

export interface CartLine {
  /** `productId:variantId` — unique per sellable unit. */
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly name: string;
  readonly variantLabel: string;
  readonly glyph: string;
  readonly unitPrice: number;
  readonly mrp?: number;
  readonly qty: number;
  readonly kind: ProductKind;
}

/** Every number the customer is shown, computed in one place. */
export interface Bill {
  readonly itemTotal: number;
  readonly mrpTotal: number;
  readonly savedOnMrp: number;
  readonly discount: number;
  readonly deliveryFee: number;
  readonly packagingFee: number;
  readonly slotSurcharge: number;
  readonly tax: number;
  readonly total: number;
  readonly couponCode: string | null;
}

/* -------------------------------------------------------------- address */

export interface Address {
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly phone: string;
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly pincode: string;
  readonly landmark: string;
}

/* -------------------------------------------------------------- payment */

export type PaymentMethod = 'upi' | 'card' | 'cod';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cash-on-delivery';

export interface PaymentIntent {
  readonly id: string;
  readonly method: PaymentMethod;
  readonly amount: number;
  readonly status: PaymentStatus;
  /** The `upi://pay?...` string the QR encodes. UPI only. */
  readonly upiUri?: string;
  /** Provider reference, once settled. */
  readonly reference?: string;
  readonly createdAt: string;
  readonly note?: string;
}

/* --------------------------------------------------------------- orders */

export type OrderStage = 'placed' | 'confirmed' | 'preparing' | 'out-for-delivery' | 'delivered';

export interface OrderEvent {
  readonly stage: OrderStage;
  readonly at: string;
  readonly note: string;
}

export interface Order {
  readonly id: string;
  readonly placedAt: string;
  readonly lines: readonly CartLine[];
  readonly bill: Bill;
  readonly address: Address;
  readonly slot: DeliverySlot;
  readonly payment: PaymentIntent;
  readonly stage: OrderStage;
  readonly timeline: readonly OrderEvent[];
  readonly etaMinutes: number;
  readonly customerEmail: string;
}
