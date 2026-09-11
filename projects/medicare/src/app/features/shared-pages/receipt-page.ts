import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaymentService, trackedState, type ConsultationBill, type OrderBill } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

/**
 * A printable receipt.
 *
 * Laid out as the document, not as an app screen: hospital header, who it was
 * billed to, the line items, the tax breakdown and a QR that resolves back to
 * the payment. It is the one page where the print stylesheet, not the browser
 * view, is the design target.
 */
@Component({
  selector: 'mc-receipt-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, QrCode, ...MC_ATOMS, ...MC_PIPES],
  template: `
    <section class="page">
      <mc-data-state
        [busy]="receipt.loading()"
        [error]="receipt.error()"
        [skeletonLines]="2"
        [skeletonHeight]="9"
        errorTitle="That receipt could not be loaded"
        (retry)="receipt.load()"
      >
        @if (receipt.data(); as doc) {
          <header class="page__head no-print">
            <div>
              <h1>Receipt</h1>
              <p>
                <span class="mono">{{ doc.receiptNo }}</span> · {{ doc.issuedAt | day }}
              </p>
            </div>

            <div class="row row--wrap">
              <a class="btn btn--outline" routerLink="/patient/payments">← All payments</a>
              <button type="button" class="btn btn--primary" (click)="print()">Print / save as PDF</button>
            </div>
          </header>

          <article class="receipt card">
            <header class="receipt__head">
              <div class="receipt__brand">
                <span class="receipt__mark" aria-hidden="true">✚</span>
                <div>
                  <strong>MediCare360</strong>
                  @if (doc.branch; as branch) {
                    <span class="text-xs muted">{{ branch.name }} · {{ branch.city }}</span>
                    <span class="text-xs muted">{{ branch.phone }}</span>
                  }
                </div>
              </div>

              <div class="receipt__meta">
                <span class="receipt__label">Receipt</span>
                <strong class="mono">{{ doc.receiptNo }}</strong>
                <span class="text-xs muted">{{ doc.issuedAt | day }}</span>
                <mc-status [status]="doc.status" />
              </div>
            </header>

            <div class="receipt__billed">
              <div>
                <span class="receipt__label">Billed to</span>
                @if (doc.billedTo; as person) {
                  <strong>{{ person.name }}</strong>
                  <p class="mono text-xs">{{ person.id }}</p>
                  <p class="text-sm">{{ person.email }}</p>
                  <p class="text-sm">{{ person.mobile }}</p>
                }
              </div>

              <div>
                <span class="receipt__label">Payment</span>
                <strong>{{ doc.method ? (doc.method | label) : 'Not settled' }}</strong>
                @if (doc.transactionId) {
                  <p class="mono text-xs">{{ doc.transactionId }}</p>
                }
              </div>
            </div>

            <div class="table-wrap">
              <table class="data">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th class="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of doc.lines; track line.label) {
                    <tr>
                      <td>
                        <strong>{{ line.label }}</strong>
                        <div class="muted text-xs">{{ line.detail }}</div>
                      </td>
                      <td class="right num">{{ line.amount | inr }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="receipt__totals">
              <ul>
                @for (row of breakdown(); track row.label) {
                  <li [class.is-credit]="row.credit">
                    <span>{{ row.label }}</span>
                    <span class="num">{{ row.value | inr }}</span>
                  </li>
                }
              </ul>

              <div class="receipt__grand">
                <span>Total paid</span>
                <strong class="num">{{ doc.amount | inr }}</strong>
              </div>
            </div>

            <footer class="receipt__foot">
              <div>
                <p class="text-xs muted">
                  This is a computer-generated receipt from a demonstration system and is not a
                  valid tax invoice. GST shown is illustrative.
                </p>
              </div>

              <mc-qr-code [value]="paymentId()" caption="Verify this receipt" [size]="280" />
            </footer>
          </article>
        }
      </mc-data-state>
    </section>
  `,
  styleUrl: './receipt-page.scss',
})
export class ReceiptPage {
  readonly paymentId = input.required<string>();

  private readonly payments = inject(PaymentService);

  protected readonly receipt = trackedState(
    () => this.paymentId(),
    () => this.payments.receipt(this.paymentId()),
  );

  /** The tax and adjustment rows under the line items. */
  protected readonly breakdown = computed(() => {
    const bill = this.receipt.data()?.breakdown;
    if (!bill) return [];

    if (isConsultationBill(bill)) {
      return [
        { label: 'Consultation fee', value: bill.fee, credit: false },
        { label: 'Hospital service charge', value: bill.serviceCharge, credit: false },
        ...(bill.discount ? [{ label: 'Discount', value: -bill.discount, credit: true }] : []),
        { label: 'GST (18%)', value: bill.tax, credit: false },
        ...(bill.insurance ? [{ label: 'Insurance contribution', value: -bill.insurance, credit: true }] : []),
      ];
    }

    return [
      { label: 'Medicines', value: bill.itemsTotal, credit: false },
      ...(bill.discount ? [{ label: 'Coupon discount', value: -bill.discount, credit: true }] : []),
      { label: 'GST (5%)', value: bill.tax, credit: false },
      { label: 'Delivery', value: bill.delivery, credit: false },
    ];
  });

  protected print(): void {
    window.print();
  }
}

function isConsultationBill(bill: ConsultationBill | OrderBill): bill is ConsultationBill {
  return 'fee' in bill;
}
