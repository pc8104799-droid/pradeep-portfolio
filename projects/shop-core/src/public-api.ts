/**
 * `@pc/shop-core` — the storefront domain: catalog, cart and bill, addresses,
 * payments and orders. No components; every screen reads through these.
 */

export * from './lib/models/shop.models';
export * from './lib/services/catalog.service';
export * from './lib/services/cart.service';
export * from './lib/services/address.service';
export * from './lib/services/payment.service';
export * from './lib/services/order.service';
