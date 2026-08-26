import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogService, OrderService, ORDER_STAGES } from '@pc/shop-core';
import { BillSummary } from '../shared/bill-summary';
import { RupeesPipe } from '../shared/rupees.pipe';

@Component({
  selector: 'shop-order-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BillSummary, RupeesPipe],
  templateUrl: './order-page.html',
  styleUrl: './order-page.scss',
})
export class OrderPage {
  protected readonly orders = inject(OrderService);
  protected readonly catalog = inject(CatalogService);

  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  protected readonly stages = ORDER_STAGES;
  protected readonly order = computed(() => this.orders.order(this.params().get('orderId') ?? ''));

  protected readonly progress = computed(() => {
    const order = this.order();
    return order ? this.orders.progressOf(order) : 0;
  });

  protected readonly reachedIndex = computed(() => {
    const order = this.order();
    return order ? ORDER_STAGES.indexOf(order.stage) : -1;
  });

  protected readonly paymentLabel = computed(() => {
    const payment = this.order()?.payment;
    if (!payment) return '';

    switch (payment.status) {
      case 'paid':
        return 'Paid';
      case 'failed':
        return 'Payment failed';
      case 'cash-on-delivery':
        return 'Cash on delivery';
      default:
        return 'Awaiting verification';
    }
  });

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  protected methodLabel(method: string): string {
    return method === 'upi' ? 'UPI' : method === 'card' ? 'Card' : 'Cash on delivery';
  }
}
