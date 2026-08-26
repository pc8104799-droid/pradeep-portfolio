import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CatalogService,
  OrderService,
  PaymentService,
  type CardDetails,
} from '@pc/shop-core';
import { RupeesPipe } from '../shared/rupees.pipe';
import { ToastService } from '../shared/toast.service';
import { UpiQr } from '../shared/upi-qr';

@Component({
  selector: 'shop-payment-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UpiQr, RupeesPipe],
  templateUrl: './payment-page.html',
  styleUrl: './payment-page.scss',
})
export class PaymentPage {
  protected readonly payments = inject(PaymentService);
  protected readonly catalog = inject(CatalogService);
  protected readonly orders = inject(OrderService);

  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  protected readonly order = computed(() => this.orders.order(this.params().get('orderId') ?? ''));

  protected readonly config = computed(() => this.catalog.config());

  /** The intent to settle: the live one, or the one stored on the order. */
  protected readonly intent = computed(() => this.payments.intent() ?? this.order()?.payment ?? null);

  protected readonly upiUri = computed(() => {
    const order = this.order();
    if (!order || !this.payments.upiConfigured()) {
      return '';
    }

    return (
      this.intent()?.upiUri ?? this.payments.buildUpiUri(order.bill.total, `FreshKart ${order.id}`)
    );
  });

  // Card form
  protected readonly card = signal<CardDetails>({ number: '', name: '', expiry: '', cvv: '' });
  protected readonly cardErrors = signal<Record<string, string>>({});
  protected readonly upiReference = signal('');
  protected readonly failure = signal('');

  protected readonly brand = computed(() => this.payments.checkCard(this.card()).brand);

  protected patchCard(key: keyof CardDetails, value: string): void {
    const cleaned = key === 'number' ? formatCardNumber(value) : value;
    this.card.update((current) => ({ ...current, [key]: cleaned }));
  }

  /** Sandbox card flow. */
  protected async payByCard(): Promise<void> {
    const order = this.order();
    if (!order) {
      return;
    }

    const check = this.payments.checkCard(this.card());
    this.cardErrors.set(check.errors);

    if (!check.ok) {
      return;
    }

    this.failure.set('');
    const settled = await this.payments.settle({ card: this.card() });
    this.orders.attachPayment(order.id, settled);

    if (settled.status === 'failed') {
      this.failure.set(settled.note ?? 'The payment was declined.');
      this.toasts.show('Payment declined', 'error');
      return;
    }

    this.toasts.show('Payment successful');
    await this.router.navigateByUrl(`/order/${order.id}`);
  }

  /** Customer has paid by UPI and is telling us so. */
  protected async confirmUpi(): Promise<void> {
    const order = this.order();
    if (!order) {
      return;
    }

    const settled = await this.payments.confirmUpi(this.upiReference());
    this.orders.attachPayment(order.id, settled);

    this.toasts.show('Thanks — we will verify and dispatch');
    await this.router.navigateByUrl(`/order/${order.id}`);
  }

  /** Falls back to cash, so a failed card is never a dead end. */
  protected async switchToCod(): Promise<void> {
    const order = this.order();
    if (!order) {
      return;
    }

    const intent = this.payments.start('cod', order.bill.total, `FreshKart ${order.id}`);
    this.orders.attachPayment(order.id, intent);

    this.toasts.show('Switched to cash on delivery');
    await this.router.navigateByUrl(`/order/${order.id}`);
  }
}

/** Groups digits in fours as the customer types. */
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}
