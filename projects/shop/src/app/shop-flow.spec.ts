import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@pc/core';
import { CartService, CatalogService, OrderService, PaymentService } from '@pc/shop-core';
import { routes } from './app.routes';

/**
 * End-to-end coverage of the routes and the ordering flow, through the real
 * components rather than the services alone.
 */
describe('storefront routes', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    TestBed.inject(CartService).clear();
  });

  afterEach(() => localStorage.clear());

  it('shows the home page with categories and bestsellers', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelectorAll('.cat').length).toBeGreaterThan(0);
    expect(page.querySelectorAll('shop-product-card').length).toBeGreaterThan(0);
    // The store name lives in the app shell, not in the routed page.
    expect(page.textContent).toContain('Offers for you');
  });

  it('lists a category from the URL', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/menu/vegetables');
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    const catalog = TestBed.inject(CatalogService);
    const expected = catalog.search({ categoryId: 'vegetables' }).length;

    expect(page.querySelectorAll('shop-product-card').length).toBe(expected);
    expect(page.textContent).toContain('Fresh Vegetables');
  });

  it('narrows by the search term in the query string', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/menu?q=biryani');
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    const cards = page.querySelectorAll('shop-product-card');

    expect(cards.length).toBeGreaterThan(0);
    expect(page.textContent).toContain('biryani');
  });

  it('shows an empty state when nothing matches', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/menu?q=definitelynotonthemenu');
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelectorAll('shop-product-card').length).toBe(0);
    expect(page.textContent).toContain('Nothing matched');
  });

  it('opens a product and adds the chosen pack to the cart', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/product/paneer');
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    const cart = TestBed.inject(CartService);

    expect(page.textContent).toContain('Fresh Paneer');
    expect(page.querySelectorAll('.variant').length).toBe(2);

    (page.querySelector('shop-qty-stepper .add') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(cart.count()).toBe(1);
    expect(cart.lines()[0].productId).toBe('paneer');
  });

  it('sends a guest to sign in before checkout, remembering the destination', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout');

    const url = TestBed.inject(Router).url;
    expect(url).toContain('/login');
    expect(url).toContain('next=%2Fcheckout');
  });

  it('lets a signed-in customer reach checkout', async () => {
    await TestBed.inject(AuthService).register('Test Buyer', 'buyer@example.com', 'longenough1');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout');

    expect(TestBed.inject(Router).url).toBe('/checkout');
  });

  it('shows the empty cart state and then the lines', async () => {
    const cart = TestBed.inject(CartService);
    const catalog = TestBed.inject(CatalogService);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/cart');
    harness.detectChanges();

    let page = harness.routeNativeElement as HTMLElement;
    expect(page.textContent).toContain('Your cart is empty');

    const tomato = catalog.product('tomato')!;
    cart.add(tomato, tomato.variants[0], 2);
    harness.detectChanges();

    page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelectorAll('.line').length).toBe(1);
    expect(page.textContent).toContain('Tomato');
  });

  it('falls back to the not-found page', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/no/such/page');
    harness.detectChanges();

    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Nothing on this shelf');
  });
});

describe('checkout to payment', () => {
  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    TestBed.inject(CartService).clear();
    await TestBed.inject(AuthService).register('Test Buyer', 'buyer@example.com', 'longenough1');
  });

  afterEach(() => localStorage.clear());

  /** Fills the cart and saves an address so checkout can proceed. */
  function prepare(): void {
    const cart = TestBed.inject(CartService);
    const catalog = TestBed.inject(CatalogService);
    const paneer = catalog.product('paneer')!;

    cart.add(paneer, paneer.variants[0], 2);
  }

  it('needs an address before the order can be placed', async () => {
    prepare();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout');
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    const place = page.querySelector('.place') as HTMLButtonElement;

    expect(place.disabled).toBeTrue();
    expect(page.textContent).toContain('Add a delivery address');
  });

  it('places a cash order and lands on tracking with the cart emptied', async () => {
    prepare();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout');
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    const cart = TestBed.inject(CartService);
    const orders = TestBed.inject(OrderService);
    const total = cart.bill().total;

    // Fill the address form.
    (page.querySelector('.btn--primary') as HTMLButtonElement).click();
    harness.detectChanges();

    const inputs = Array.from(page.querySelectorAll('.form input')) as HTMLInputElement[];
    const set = (index: number, value: string) => {
      inputs[index].value = value;
      inputs[index].dispatchEvent(new Event('input'));
    };

    set(0, 'Test Buyer');
    set(1, '9876543210');
    set(2, '12 Green Street');
    set(4, 'Thane');
    set(5, '400607');
    harness.detectChanges();

    (page.querySelector('.form__actions .btn--primary') as HTMLButtonElement).click();
    harness.detectChanges();

    // Choose cash on delivery, then place.
    const cod = Array.from(page.querySelectorAll('.method input')).at(-1) as HTMLInputElement;
    cod.click();
    harness.detectChanges();

    // Placing navigates asynchronously, so wait for the router to settle rather
    // than assuming the click completed synchronously.
    (page.querySelector('.place') as HTMLButtonElement).click();

    const router = TestBed.inject(Router);
    for (let i = 0; i < 40 && !router.url.includes('/order/'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    harness.detectChanges();

    expect(orders.orders().length).toBe(1);
    expect(orders.orders()[0].bill.total).toBeCloseTo(total, 2);
    expect(orders.orders()[0].payment.method).toBe('cod');
    expect(cart.isEmpty()).toBeTrue();
    expect(router.url).toContain('/order/');
  });

  it('shows the UPI setup notice while no VPA is configured', async () => {
    const orders = TestBed.inject(OrderService);
    const payments = TestBed.inject(PaymentService);
    const cart = TestBed.inject(CartService);
    const catalog = TestBed.inject(CatalogService);

    const paneer = catalog.product('paneer')!;
    cart.add(paneer, paneer.variants[0]);

    const order = orders.place({
      lines: cart.lines(),
      bill: cart.bill(),
      address: {
        id: 'a1',
        label: 'Home',
        name: 'Test Buyer',
        phone: '9876543210',
        line1: '12 Green Street',
        line2: '',
        city: 'Thane',
        pincode: '400607',
        landmark: '',
      },
      slot: catalog.slots()[1],
      payment: payments.start('upi', cart.bill().total, 'test'),
      customerEmail: 'buyer@example.com',
      etaMinutes: 40,
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/pay/${order.id}`);
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    expect(page.textContent).toContain('UPI is not configured yet');
    expect(page.textContent).toContain('config.upiId');
  });

  it('tracks a placed order through its stages', async () => {
    const orders = TestBed.inject(OrderService);
    const payments = TestBed.inject(PaymentService);
    const cart = TestBed.inject(CartService);
    const catalog = TestBed.inject(CatalogService);

    const paneer = catalog.product('paneer')!;
    cart.add(paneer, paneer.variants[0]);

    const order = orders.place({
      lines: cart.lines(),
      bill: cart.bill(),
      address: {
        id: 'a1',
        label: 'Home',
        name: 'Test Buyer',
        phone: '9876543210',
        line1: '12 Green Street',
        line2: '',
        city: 'Thane',
        pincode: '400607',
        landmark: '',
      },
      slot: catalog.slots()[1],
      payment: payments.start('cod', cart.bill().total, 'test'),
      customerEmail: 'buyer@example.com',
      etaMinutes: 40,
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/order/${order.id}`);
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    expect(page.textContent).toContain(order.id);
    expect(page.querySelectorAll('.stage').length).toBe(5);
    expect(page.querySelectorAll('.stage.is-done').length).toBe(1);

    orders.advance(order.id);
    harness.detectChanges();
    expect((harness.routeNativeElement as HTMLElement).querySelectorAll('.stage.is-done').length).toBe(2);
  });
});
