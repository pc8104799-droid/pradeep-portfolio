import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@pc/core';
import {
  AddressService,
  CartService,
  CatalogService,
  OrderService,
  PaymentService,
  type Address,
  type PaymentMethod,
} from '@pc/shop-core';
import { BillSummary } from '../shared/bill-summary';
import { RupeesPipe } from '../shared/rupees.pipe';
import { ToastService } from '../shared/toast.service';

type Draft = Omit<Address, 'id'> & { id?: string };

const EMPTY_DRAFT: Draft = {
  label: 'Home',
  name: '',
  phone: '',
  line1: '',
  line2: '',
  city: 'Thane',
  pincode: '',
  landmark: '',
};

/**
 * Address, slot and payment method in one page, then the order is created and
 * the customer moves to the payment step.
 */
@Component({
  selector: 'shop-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BillSummary, RupeesPipe],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.scss',
})
export class CheckoutPage {
  protected readonly cart = inject(CartService);
  protected readonly catalog = inject(CatalogService);
  protected readonly addresses = inject(AddressService);
  protected readonly auth = inject(AuthService);
  protected readonly payments = inject(PaymentService);

  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly method = signal<PaymentMethod>('upi');
  protected readonly draft = signal<Draft>({ ...EMPTY_DRAFT });
  protected readonly formOpen = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly placing = signal(false);

  protected readonly config = computed(() => this.catalog.config());

  /** Minutes promised, taken from the slowest kitchen in the cart. */
  protected readonly eta = computed(() => {
    const ids = new Set(
      this.cart
        .lines()
        .map((line) => this.catalog.product(line.productId)?.kitchenId)
        .filter(Boolean) as string[],
    );

    const times = [...ids].map((id) => this.catalog.kitchen(id)?.etaMinutes ?? 40);
    const base = times.length ? Math.max(...times) : 40;

    return this.cart.slot().id === 'express' ? Math.max(25, Math.round(base * 0.7)) : base;
  });

  protected readonly canPlace = computed(
    () => !this.cart.isEmpty() && this.addresses.selected() !== null && !this.placing(),
  );

  protected openForm(address?: Address): void {
    this.draft.set(address ? { ...address } : { ...EMPTY_DRAFT, name: this.auth.user()?.name ?? '' });
    this.errors.set({});
    this.formOpen.set(true);
  }

  protected patch(key: keyof Draft, value: string): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
  }

  protected saveAddress(): void {
    const problems = this.addresses.validate(this.draft());
    this.errors.set(problems);

    if (Object.keys(problems).length) {
      return;
    }

    this.addresses.save(this.draft());
    this.formOpen.set(false);
    this.toasts.show('Address saved');
  }

  protected async place(): Promise<void> {
    const address = this.addresses.selected();
    if (!address || this.cart.isEmpty()) {
      return;
    }

    this.placing.set(true);

    try {
      const bill = this.cart.bill();
      const intent = this.payments.start(
        this.method(),
        bill.total,
        `FreshKart order for ${address.name}`,
      );

      const order = this.orders.place({
        lines: this.cart.lines(),
        bill,
        address,
        slot: this.cart.slot(),
        payment: intent,
        customerEmail: this.auth.user()?.email ?? this.config().supportEmail,
        etaMinutes: this.eta(),
      });

      this.cart.clear();

      // Cash on delivery needs no payment screen.
      await this.router.navigateByUrl(
        this.method() === 'cod' ? `/order/${order.id}` : `/pay/${order.id}`,
      );
    } finally {
      this.placing.set(false);
    }
  }
}
