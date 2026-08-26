import { TestBed } from '@angular/core/testing';
import { CartService } from '@pc/shop-core';
import { BUNDLED_CATALOG, CatalogService } from '@pc/shop-core';
import { OrderService, ORDER_STAGES } from '@pc/shop-core';
import { PaymentService } from '@pc/shop-core';
import { AddressService } from '@pc/shop-core';
import type { Address } from '@pc/shop-core';

/** The catalog every test works against. */
const catalog = BUNDLED_CATALOG;

function product(id: string) {
  const found = catalog.products.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`fixture missing product ${id}`);
  }
  return found;
}

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CatalogService);
  });

  it('exposes the bundled catalog without a fetch', () => {
    expect(service.products().length).toBe(catalog.products.length);
    expect(service.categories().length).toBeGreaterThan(0);
    expect(service.config().supportEmail).toBe('devpradeep50@gmail.com');
  });

  it('separates food from groceries', () => {
    expect(service.categoriesFor('food').every((c) => c.kind === 'food')).toBeTrue();
    expect(service.categoriesFor('grocery').every((c) => c.kind === 'grocery')).toBeTrue();
    expect(service.search({ kind: 'food' }).every((p) => p.kind === 'food')).toBeTrue();
  });

  it('searches name, tags, category and kitchen', () => {
    expect(service.search({ search: 'biryani' }).length).toBeGreaterThan(0);
    expect(service.search({ search: 'tandoori junction' }).length).toBeGreaterThan(0);
    expect(service.search({ search: 'zzzznope' }).length).toBe(0);
  });

  it('treats the veg filter as excluding egg', () => {
    const veg = service.search({ diet: 'veg' });
    expect(veg.length).toBeGreaterThan(0);
    expect(veg.every((p) => p.diet === 'veg')).toBeTrue();
    expect(veg.some((p) => p.diet === 'egg')).toBeFalse();
  });

  it('sorts by price in both directions', () => {
    const asc = service.search({ sort: 'price-asc' }).map((p) => service.fromPrice(p));
    const desc = service.search({ sort: 'price-desc' }).map((p) => service.fromPrice(p));

    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it('quotes the cheapest in-stock variant', () => {
    const peas = product('green-peas');
    // The 500 g pack is deliberately out of stock in the catalog.
    expect(peas.variants.some((v) => !v.inStock)).toBeTrue();

    const cheapestInStock = Math.min(
      ...peas.variants.filter((v) => v.inStock).map((v) => v.price),
    );
    expect(service.fromPrice(peas)).toBe(cheapestInStock);
  });

  it('honours a price ceiling', () => {
    const under100 = service.search({ maxPrice: 100 });
    expect(under100.length).toBeGreaterThan(0);
    expect(under100.every((p) => service.fromPrice(p) <= 100)).toBeTrue();
  });
});

describe('CartService', () => {
  let cart: CartService;
  let service: CatalogService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    cart = TestBed.inject(CartService);
    service = TestBed.inject(CatalogService);
    cart.clear();
  });

  afterEach(() => localStorage.clear());

  /** Adds n of a product's first variant. */
  function add(id: string, qty = 1): void {
    const item = product(id);
    cart.add(item, item.variants[0], qty);
  }

  it('starts empty', () => {
    expect(cart.isEmpty()).toBeTrue();
    expect(cart.bill().total).toBe(0);
  });

  it('adds, increments and removes lines', () => {
    add('tomato');
    expect(cart.count()).toBe(1);

    add('tomato');
    expect(cart.count()).toBe(2);
    expect(cart.lines().length).toBe(1);

    cart.decrement(cart.lines()[0].id);
    expect(cart.count()).toBe(1);

    cart.decrement(cart.lines()[0].id);
    expect(cart.isEmpty()).toBeTrue();
  });

  it('keeps variants of one product as separate lines', () => {
    const onion = product('onion');
    cart.add(onion, onion.variants[0]);
    cart.add(onion, onion.variants[1]);

    expect(cart.lines().length).toBe(2);
    expect(cart.qtyOfProduct('onion')).toBe(2);
  });

  it('refuses an out-of-stock variant', () => {
    const peas = product('green-peas');
    const outOfStock = peas.variants.find((v) => !v.inStock)!;

    cart.add(peas, outOfStock);
    expect(cart.isEmpty()).toBeTrue();
  });

  it('caps a line at 20', () => {
    add('tomato', 19);
    cart.increment(cart.lines()[0].id);
    cart.increment(cart.lines()[0].id);

    expect(cart.lines()[0].qty).toBe(20);
  });

  it('adds up the item total from unit price times quantity', () => {
    const item = product('paneer');
    cart.add(item, item.variants[0], 3);

    expect(cart.itemTotal()).toBeCloseTo(item.variants[0].price * 3, 2);
  });

  it('charges delivery below the threshold and drops it above', () => {
    const config = service.config();

    add('tomato');
    expect(cart.itemTotal()).toBeLessThan(config.freeDeliveryOver);
    expect(cart.bill().deliveryFee).toBe(config.deliveryFee);

    const mango = product('alphonso');
    cart.add(mango, mango.variants[0]);
    expect(cart.itemTotal()).toBeGreaterThanOrEqual(config.freeDeliveryOver);
    expect(cart.bill().deliveryFee).toBe(0);
  });

  it('caps a percentage coupon at its ceiling', () => {
    const mango = product('alphonso');
    cart.add(mango, mango.variants[1]);

    const result = cart.applyCoupon('FRESH20');
    expect(result.ok).toBeTrue();

    const coupon = service.coupons().find((c) => c.code === 'FRESH20')!;
    // 20% of a 1199 mango box exceeds the 150 cap.
    expect(cart.bill().discount).toBe(coupon.maxDiscount!);
  });

  it('applies a flat coupon and a free-delivery coupon differently', () => {
    const mango = product('alphonso');
    cart.add(mango, mango.variants[0]);

    cart.applyCoupon('SAVE75');
    expect(cart.bill().discount).toBe(75);

    cart.applyCoupon('FREESHIP');
    expect(cart.bill().discount).toBe(0);
    expect(cart.bill().deliveryFee).toBe(0);
  });

  it('rejects a coupon below its minimum and says how much is missing', () => {
    add('tomato');
    const result = cart.applyCoupon('SAVE75');

    expect(result.ok).toBeFalse();
    expect(result.message).toContain('more');
    expect(cart.bill().discount).toBe(0);
  });

  it('rejects an unknown code', () => {
    add('tomato');
    expect(cart.applyCoupon('NOPE123').ok).toBeFalse();
  });

  it('drops a coupon that no longer qualifies when the cart shrinks', () => {
    const mango = product('alphonso');
    cart.add(mango, mango.variants[0]);
    cart.applyCoupon('SAVE75');
    expect(cart.bill().discount).toBe(75);

    cart.clear();
    add('tomato');
    // The code is remembered but must not discount an ineligible cart.
    expect(cart.bill().discount).toBe(0);
  });

  it('taxes the discounted goods value, not the fees', () => {
    const mango = product('alphonso');
    cart.add(mango, mango.variants[0]);
    cart.applyCoupon('SAVE75');

    const bill = cart.bill();
    const expected = ((bill.itemTotal - bill.discount) * service.config().taxPercent) / 100;
    expect(bill.tax).toBeCloseTo(expected, 2);
  });

  it('totals to items − discount + fees + tax', () => {
    add('paneer', 2);
    cart.chooseSlot('express');

    const b = cart.bill();
    const expected =
      b.itemTotal - b.discount + b.deliveryFee + b.packagingFee + b.slotSurcharge + b.tax;

    expect(b.total).toBeCloseTo(expected, 2);
  });

  it('adds the express slot surcharge only for express', () => {
    add('paneer');

    cart.chooseSlot('standard');
    expect(cart.bill().slotSurcharge).toBe(0);

    cart.chooseSlot('express');
    expect(cart.bill().slotSurcharge).toBeGreaterThan(0);
  });

  it('reports MRP savings', () => {
    const item = product('tomato');
    cart.add(item, item.variants[0], 2);

    const mrp = item.variants[0].mrp!;
    expect(cart.bill().savedOnMrp).toBeCloseTo((mrp - item.variants[0].price) * 2, 2);
  });

  it('survives a reload', () => {
    add('atta');
    const restored = TestBed.inject(CartService);
    expect(restored.count()).toBe(1);
  });
});

describe('PaymentService', () => {
  let payments: PaymentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    payments = TestBed.inject(PaymentService);
  });

  it('reports UPI as unconfigured while the VPA is blank', () => {
    // Shipped blank on purpose: a QR pays whoever it names.
    expect(payments.upiConfigured()).toBeFalse();
  });

  it('builds a UPI intent with the amount fixed to two decimals', () => {
    const uri = payments.buildUpiUri(249.5, 'FreshKart FK123');

    expect(uri.startsWith('upi://pay?')).toBeTrue();
    expect(uri).toContain('am=249.50');
    expect(uri).toContain('cu=INR');
    expect(uri).toContain('tn=FreshKart+FK123');
  });

  it('accepts a valid card and names the brand', () => {
    const check = payments.checkCard({
      number: '4111 1111 1111 1111',
      name: 'Pradeep Chauhan',
      expiry: '12/34',
      cvv: '123',
    });

    expect(check.ok).toBeTrue();
    expect(check.brand).toBe('Visa');
  });

  it('rejects a number that fails the Luhn checksum', () => {
    const check = payments.checkCard({
      number: '4111 1111 1111 1112',
      name: 'Pradeep Chauhan',
      expiry: '12/34',
      cvv: '123',
    });

    expect(check.ok).toBeFalse();
    expect(check.errors['number']).toContain('checksum');
  });

  it('rejects an expired card and a bad CVV length', () => {
    const expired = payments.checkCard({
      number: '4111111111111111',
      name: 'Test Person',
      expiry: '01/20',
      cvv: '123',
    });
    expect(expired.errors['expiry']).toContain('expired');

    const amex = payments.checkCard({
      number: '378282246310005',
      name: 'Test Person',
      expiry: '12/34',
      cvv: '123',
    });
    expect(amex.brand).toBe('Amex');
    expect(amex.errors['cvv']).toContain('4 digits');
  });

  it('captures a sandbox card payment', async () => {
    payments.start('card', 499, 'note');
    const settled = await payments.settle({
      card: { number: '4111111111111111', name: 'T P', expiry: '12/34', cvv: '123' },
    });

    expect(settled.status).toBe('paid');
    expect(settled.reference).toBeTruthy();
  });

  it('declines a card ending 0000 so the failure path is reachable', async () => {
    payments.start('card', 499, 'note');
    const settled = await payments.settle({
      // Valid Luhn, ends 0000.
      card: { number: '4000 0000 0000 0000', name: 'T P', expiry: '12/34', cvv: '123' },
    });

    expect(settled.status).toBe('failed');
    expect(settled.reference).toBeUndefined();
  });

  it('leaves UPI pending until the customer confirms', async () => {
    payments.start('upi', 249, 'note');
    expect((await payments.settle()).status).toBe('pending');

    const confirmed = await payments.confirmUpi('402912345678');
    expect(confirmed.status).toBe('paid');
    expect(confirmed.reference).toBe('402912345678');
  });

  it('marks cash on delivery without settling anything', () => {
    const intent = payments.start('cod', 249, 'note');
    expect(intent.status).toBe('cash-on-delivery');
    expect(intent.upiUri).toBeUndefined();
  });
});

describe('OrderService', () => {
  let orders: OrderService;
  let payments: PaymentService;

  const address: Address = {
    id: 'a1',
    label: 'Home',
    name: 'Pradeep',
    phone: '9876543210',
    line1: '12 Green Street',
    line2: '',
    city: 'Thane',
    pincode: '400607',
    landmark: '',
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    orders = TestBed.inject(OrderService);
    payments = TestBed.inject(PaymentService);
    orders.clearHistory();
  });

  afterEach(() => localStorage.clear());

  function place() {
    const cart = TestBed.inject(CartService);
    const item = product('paneer');
    cart.clear();
    cart.add(item, item.variants[0], 2);

    return orders.place({
      lines: cart.lines(),
      bill: cart.bill(),
      address,
      slot: BUNDLED_CATALOG.slots[1],
      payment: payments.start('cod', cart.bill().total, 'test'),
      customerEmail: 'buyer@example.com',
      etaMinutes: 40,
    });
  }

  it('places an order with an id, a timeline and the bill it was charged', () => {
    const order = place();

    expect(order.id.startsWith('FK')).toBeTrue();
    expect(order.stage).toBe('placed');
    expect(order.timeline.length).toBe(1);
    expect(order.bill.total).toBeGreaterThan(0);
    expect(orders.order(order.id)).toBeTruthy();
  });

  it('lists newest first', () => {
    const first = place();
    const second = place();

    expect(orders.orders()[0].id).toBe(second.id);
    expect(orders.orders()[1].id).toBe(first.id);
  });

  it('advances through the stages and stops at delivered', () => {
    const order = place();

    for (let i = 0; i < ORDER_STAGES.length + 2; i++) {
      orders.advance(order.id);
    }

    const done = orders.order(order.id)!;
    expect(done.stage).toBe('delivered');
    expect(done.timeline.length).toBe(ORDER_STAGES.length);
    expect(orders.progressOf(done)).toBe(1);
  });

  it('records a payment result against the order', async () => {
    const order = place();
    payments.start('card', order.bill.total, 'x');
    const settled = await payments.settle({
      card: { number: '4111111111111111', name: 'T P', expiry: '12/34', cvv: '123' },
    });

    orders.attachPayment(order.id, settled);
    expect(orders.order(order.id)!.payment.status).toBe('paid');
  });

  it('counts an undelivered order as active', () => {
    const order = place();
    expect(orders.active().length).toBe(1);

    for (let i = 0; i < ORDER_STAGES.length; i++) {
      orders.advance(order.id);
    }
    expect(orders.active().length).toBe(0);
  });
});

describe('AddressService', () => {
  let addresses: AddressService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    addresses = TestBed.inject(AddressService);
  });

  afterEach(() => localStorage.clear());

  it('saves, selects, updates and removes', () => {
    const saved = addresses.save({
      label: 'Home',
      name: 'Pradeep',
      phone: '9876543210',
      line1: '12 Green Street',
      line2: '',
      city: 'Thane',
      pincode: '400607',
      landmark: '',
    });

    expect(addresses.addresses().length).toBe(1);
    expect(addresses.selected()?.id).toBe(saved.id);

    addresses.save({ ...saved, city: 'Mulund' });
    expect(addresses.addresses().length).toBe(1);
    expect(addresses.selected()?.city).toBe('Mulund');

    addresses.remove(saved.id);
    expect(addresses.addresses().length).toBe(0);
    expect(addresses.selected()).toBeNull();
  });

  it('validates phone and PIN code', () => {
    const errors = addresses.validate({ name: 'P', phone: '12345', line1: 'x', city: '', pincode: '12' });

    expect(errors['name']).toBeDefined();
    expect(errors['phone']).toBeDefined();
    expect(errors['line1']).toBeDefined();
    expect(errors['city']).toBeDefined();
    expect(errors['pincode']).toBeDefined();

    const ok = addresses.validate({
      name: 'Pradeep',
      phone: '+91 9876543210',
      line1: '12 Green Street',
      city: 'Thane',
      pincode: '400607',
    });
    expect(Object.keys(ok).length).toBe(0);
  });
});
