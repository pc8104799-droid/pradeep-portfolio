import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  ORDER_STAGES,
  PharmacyService,
  ToastService,
  trackedState,
  type MedicineOrder,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { ConfirmService } from '../../shared/ui/dialogs';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

const STAGE_COPY: Record<string, { label: string; note: string }> = {
  placed: { label: 'Order placed', note: 'We have your order.' },
  confirmed: { label: 'Confirmed', note: 'Payment received and the pharmacy has accepted it.' },
  preparing: { label: 'Being prepared', note: 'A pharmacist is picking and checking your items.' },
  'ready-for-pickup': { label: 'Ready for pickup', note: 'Waiting at the pharmacy counter.' },
  'out-for-delivery': { label: 'Out for delivery', note: 'On the way to your address.' },
  delivered: { label: 'Delivered', note: 'Handed over. Keep the bill for your records.' },
  cancelled: { label: 'Cancelled', note: 'This order was cancelled and the stock returned.' },
};

/**
 * One order, tracked.
 *
 * The timeline is built from what the server actually recorded, not from a
 * guess: each stage carries the moment it happened, and stages still ahead are
 * shown greyed rather than hidden, so a patient can see what is left.
 */
@Component({
  selector: 'mc-order-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, QrCode, ...MC_ATOMS, ...MC_PIPES],
  template: `
    <section class="page">
      <mc-data-state
        [busy]="order.loading()"
        [error]="order.error()"
        [skeletonLines]="3"
        [skeletonHeight]="6"
        errorTitle="That order could not be loaded"
        (retry)="order.load()"
      >
        @if (order.data(); as record) {
          <header class="page__head">
            <div>
              <h1>Order {{ record.id }}</h1>
              <p>
                Placed {{ record.placedAt | day }} · {{ record.lines.length }} item{{
                  record.lines.length === 1 ? '' : 's'
                }}
              </p>
            </div>

            <div class="row row--wrap">
              <a class="btn btn--outline" routerLink="/patient/pharmacy/orders">← All orders</a>
              @if (canCancel()) {
                <button type="button" class="btn btn--ghost" [disabled]="action.busy()" (click)="cancel()">
                  Cancel order
                </button>
              }
            </div>
          </header>

          @if (record.paymentStatus === 'pending') {
            <div class="card card--pad card--rail card--warning spread">
              <div>
                <h2>Payment pending</h2>
                <p class="text-sm">
                  The pharmacy starts preparing this order once the payment goes through.
                </p>
              </div>
              <a class="btn btn--primary" [routerLink]="['/patient/pay', record.paymentId]">
                Pay {{ record.bill.total | inr }}
              </a>
            </div>
          }

          <div class="split">
            <div class="stack">
              <article class="card card--pad stack--sm">
                <div class="spread">
                  <h2>Progress</h2>
                  <mc-status [status]="record.stage" />
                </div>

                <ol class="track">
                  @for (step of track(record); track step.stage) {
                    <li [class.is-done]="step.done" [class.is-current]="step.current">
                      <span class="track__dot" aria-hidden="true"></span>
                      <div>
                        <strong>{{ step.label }}</strong>
                        <span class="muted text-sm">{{ step.note }}</span>
                        @if (step.at) {
                          <span class="muted text-xs">{{ step.at | when }}</span>
                        }
                      </div>
                    </li>
                  }
                </ol>
              </article>

              <article class="card card--flush">
                <header class="card__head"><h2>Items</h2></header>

                <div class="table-wrap">
                  <table class="data">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Qty</th>
                        <th class="right">Price</th>
                        <th class="right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of record.lines; track line.medicineId) {
                        <tr>
                          <td>
                            <a [routerLink]="['/patient/pharmacy', line.medicineId]">
                              <strong>{{ line.name }}</strong>
                            </a>
                            <div class="muted text-xs">
                              {{ line.strength }} · {{ line.form }}
                              @if (line.prescriptionRequired) {
                                · ℞ only
                              }
                            </div>
                          </td>
                          <td class="num">{{ line.quantity }}</td>
                          <td class="right num">{{ line.price | inr }}</td>
                          <td class="right num">
                            <strong>{{ line.price * line.quantity | inr }}</strong>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <aside class="stack">
              <article class="card card--pad stack--sm">
                <h2>Bill</h2>

                <ul class="bill">
                  <li>
                    <span>Medicines</span>
                    <span class="num">{{ record.bill.itemsTotal | inr }}</span>
                  </li>
                  @if (record.bill.discount) {
                    <li class="is-credit">
                      <span>Discount</span>
                      <span class="num">−{{ record.bill.discount | inr }}</span>
                    </li>
                  }
                  <li>
                    <span>GST (5%)</span>
                    <span class="num">{{ record.bill.tax | inr }}</span>
                  </li>
                  <li>
                    <span>Delivery</span>
                    <span class="num">{{ record.bill.delivery | inr }}</span>
                  </li>
                </ul>

                <div class="bill__total">
                  <span>Total</span>
                  <strong class="num">{{ record.bill.total | inr }}</strong>
                </div>

                @if (record.paymentStatus === 'successful') {
                  <a class="btn btn--outline btn--block" [routerLink]="['/patient/payments', record.paymentId]">
                    View receipt
                  </a>
                }
              </article>

              <article class="card card--pad stack--sm">
                <h2>Delivering to</h2>
                <strong>{{ record.address.name }}</strong>
                <p class="text-sm">
                  {{ record.address.line1 }}, {{ record.address.city }},
                  {{ record.address.state }} {{ record.address.pincode }}
                </p>
                <p class="text-sm muted">{{ record.address.phone }}</p>
                <p class="text-sm">
                  <strong>Slot:</strong> {{ record.deliverySlot }}
                </p>
              </article>

              @if (record.prescriptionId; as prescriptionId) {
                <article class="card card--pad stack--sm">
                  <h2>Prescription</h2>
                  <p class="text-sm">
                    <span class="mono">{{ prescriptionId }}</span>
                    <mc-status [status]="record.prescriptionStatus" />
                  </p>
                  <a class="btn btn--outline btn--sm" [routerLink]="['/patient/prescriptions', prescriptionId]">
                    View prescription
                  </a>
                </article>
              }

              <article class="card card--pad qr-card">
                <h2>Order QR</h2>
                <p class="text-xs muted">Show this at the pharmacy counter for a collection.</p>
                <mc-qr-code [value]="record.id" [caption]="record.deliverySlot" [size]="300" />
              </article>
            </aside>
          </div>
        }
      </mc-data-state>
    </section>
  `,
  styleUrl: './order-detail-page.scss',
})
export class OrderDetailPage {
  readonly orderId = input.required<string>();

  private readonly pharmacy = inject(PharmacyService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly action = new ActionState();

  protected readonly order = trackedState(
    () => this.orderId(),
    () => this.pharmacy.order(this.orderId()),
  );

  protected readonly canCancel = computed(() => {
    const stage = this.order.data()?.stage;
    return !!stage && !['out-for-delivery', 'delivered', 'cancelled'].includes(stage);
  });

  /** The full stage list, annotated with what has happened and when. */
  protected track(order: MedicineOrder) {
    if (order.stage === 'cancelled') {
      return [
        ...order.timeline.map((event) => ({
          stage: event.stage,
          label: STAGE_COPY[event.stage]?.label ?? event.stage,
          note: STAGE_COPY[event.stage]?.note ?? '',
          at: event.at,
          done: true,
          current: event.stage === 'cancelled',
        })),
      ];
    }

    const reached = ORDER_STAGES.indexOf(order.stage);

    return ORDER_STAGES.map((stage, index) => ({
      stage,
      label: STAGE_COPY[stage]?.label ?? stage,
      note: STAGE_COPY[stage]?.note ?? '',
      at: order.timeline.find((event) => event.stage === stage)?.at ?? null,
      done: index <= reached,
      current: index === reached,
    }));
  }

  protected async cancel(): Promise<void> {
    const record = this.order.data();
    if (!record) return;

    const agreed = await this.confirm.ask({
      heading: 'Cancel this order?',
      body:
        record.paymentStatus === 'successful'
          ? 'The order will be cancelled, the stock returned and a refund raised.'
          : 'The order will be cancelled and the stock returned.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });

    if (!agreed) return;

    const updated = await this.action.run(() => this.pharmacy.cancelOrder(record.id));
    if (!updated) {
      this.toasts.error('Could not cancel', this.action.error()?.message);
      return;
    }

    this.order.set(updated);
    this.toasts.success('Order cancelled', updated.paymentStatus === 'refunded' ? 'A refund has been raised.' : undefined);
  }
}
