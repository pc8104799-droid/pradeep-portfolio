import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ActionState,
  PaymentService,
  PAYMENT_METHODS,
  ToastService,
  trackedState,
  type ConsultationBill,
  type OrderBill,
  type Payment,
  type PaymentMethod,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * The payment screen.
 *
 * No money moves and the page says so. What it does model honestly is the part
 * most demos skip: the amount is the server's, not the browser's; a decline is
 * a real outcome you can trigger and recover from; and what the payment
 * confirms — an appointment, an order — is updated by the server in the same
 * request, never by this component.
 */
@Component({
  selector: 'mc-payment-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './payment-page.html',
  styleUrl: './payment-page.scss',
})
export class PaymentPage {
  readonly paymentId = input.required<string>();

  private readonly payments = inject(PaymentService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly methods = PAYMENT_METHODS;
  protected readonly action = new ActionState();

  protected readonly method = signal<PaymentMethod>('upi');
  protected readonly simulateFailure = signal(false);
  protected readonly declined = signal<string | null>(null);

  protected readonly payment = trackedState(
    () => this.paymentId(),
    async () => {
      const payment = await this.payments.get(this.paymentId());

      // An insured patient defaults to the method that reflects their cover.
      if (isConsultationBill(payment.breakdown) && payment.breakdown.insurance > 0) {
        this.method.set('insurance');
      }

      return payment;
    },
  );

  protected readonly settled = computed(() => this.payment.data()?.status === 'successful');

  /** The bill rows, whichever kind of purchase this is. */
  protected readonly lines = computed(() => {
    const payment = this.payment.data();
    if (!payment) return [];

    const bill = payment.breakdown;

    if (isConsultationBill(bill)) {
      return [
        { label: 'Consultation fee', value: bill.fee, tone: '' },
        { label: 'Hospital service charge (5%)', value: bill.serviceCharge, tone: '' },
        ...(bill.discount ? [{ label: 'Discount', value: -bill.discount, tone: 'credit' }] : []),
        { label: 'GST (18%)', value: bill.tax, tone: '' },
        ...(bill.insurance
          ? [{ label: 'Insurance covers', value: -bill.insurance, tone: 'credit' }]
          : []),
      ];
    }

    return [
      { label: 'Medicines', value: bill.itemsTotal, tone: '' },
      ...(bill.discount ? [{ label: 'Coupon discount', value: -bill.discount, tone: 'credit' }] : []),
      { label: 'GST (5%)', value: bill.tax, tone: '' },
      { label: bill.delivery ? 'Delivery' : 'Delivery (free over ₹499)', value: bill.delivery, tone: '' },
    ];
  });

  protected async pay(): Promise<void> {
    this.declined.set(null);

    const outcome = await this.action.run(() =>
      this.payments.pay(this.paymentId(), this.method(), this.simulateFailure() ? 'failure' : 'success'),
    );

    if (!outcome) return;

    if (outcome.declined) {
      this.payment.set(outcome.payment);
      this.declined.set(outcome.message ?? 'The bank declined this transaction.');
      this.toasts.error('Payment declined', 'Try another method — nothing was charged.');
      return;
    }

    this.payment.set(outcome.payment);
    this.toasts.success(
      'Payment successful',
      outcome.payment.kind === 'consultation'
        ? 'Your appointment is confirmed.'
        : 'The pharmacy is preparing your order.',
      { label: 'View receipt', link: `/patient/payments/${outcome.payment.id}` },
    );

    await this.router.navigateByUrl(this.successRoute(outcome.payment));
  }

  /** Where a settled payment sends the user next. */
  private successRoute(payment: Payment): string {
    return payment.kind === 'consultation'
      ? `/patient/appointments/${payment.referenceId}`
      : `/patient/pharmacy/orders/${payment.referenceId}`;
  }

  protected backLink(payment: Payment): string {
    return payment.kind === 'consultation'
      ? `/patient/appointments/${payment.referenceId}`
      : `/patient/pharmacy/orders/${payment.referenceId}`;
  }
}

function isConsultationBill(bill: ConsultationBill | OrderBill): bill is ConsultationBill {
  return 'fee' in bill;
}
