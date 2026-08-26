import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import type {
  Address,
  Bill,
  CartLine,
  DeliverySlot,
  Order,
  OrderEvent,
  OrderStage,
  PaymentIntent,
} from '../models/shop.models';

const STORAGE_KEY = 'freshkart-orders';

/** The stages an order moves through, in order. */
export const ORDER_STAGES: readonly OrderStage[] = [
  'placed',
  'confirmed',
  'preparing',
  'out-for-delivery',
  'delivered',
];

const STAGE_COPY: Record<OrderStage, { label: string; note: string }> = {
  placed: { label: 'Order placed', note: 'We have your order.' },
  confirmed: { label: 'Confirmed', note: 'The kitchen accepted your order.' },
  preparing: { label: 'Being prepared', note: 'Your items are being packed.' },
  'out-for-delivery': { label: 'Out for delivery', note: 'Your rider is on the way.' },
  delivered: { label: 'Delivered', note: 'Handed over. Enjoy.' },
};

export interface PlaceOrderInput {
  readonly lines: readonly CartLine[];
  readonly bill: Bill;
  readonly address: Address;
  readonly slot: DeliverySlot;
  readonly payment: PaymentIntent;
  readonly customerEmail: string;
  readonly etaMinutes: number;
}

/**
 * Orders, and the progress they make after being placed.
 *
 * With no server there is nothing to poll, so an order advances on a local
 * timer: honest enough for tracking a real order placed a minute ago, and the
 * one place to replace with a websocket or polling call when a backend exists.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly _orders = signal<Order[]>(this.restore());
  readonly orders = this._orders.asReadonly();

  readonly latest = computed(() => this._orders()[0] ?? null);
  readonly active = computed(() =>
    this._orders().filter((order) => order.stage !== 'delivered'),
  );

  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._orders()));
      } catch {
        // Orders will not survive a refresh; nothing else breaks.
      }
    });

    this.startProgress();
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
  }

  order(id: string): Order | undefined {
    return this._orders().find((order) => order.id === id);
  }

  place(input: PlaceOrderInput): Order {
    const now = new Date();
    const first: OrderEvent = {
      stage: 'placed',
      at: now.toISOString(),
      note: STAGE_COPY.placed.note,
    };

    const order: Order = {
      id: `FK${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${randomDigits(5)}`,
      placedAt: now.toISOString(),
      lines: input.lines,
      bill: input.bill,
      address: input.address,
      slot: input.slot,
      payment: input.payment,
      stage: 'placed',
      timeline: [first],
      etaMinutes: input.etaMinutes,
      customerEmail: input.customerEmail,
    };

    // Newest first — every list in the UI reads in this order.
    this._orders.update((orders) => [order, ...orders]);
    return order;
  }

  /** Moves an order to the next stage, recording the event. */
  advance(id: string): void {
    this._orders.update((orders) =>
      orders.map((order) => {
        if (order.id !== id) {
          return order;
        }

        const next = ORDER_STAGES[ORDER_STAGES.indexOf(order.stage) + 1];
        if (!next) {
          return order;
        }

        return {
          ...order,
          stage: next,
          timeline: [
            ...order.timeline,
            { stage: next, at: new Date().toISOString(), note: STAGE_COPY[next].note },
          ],
        };
      }),
    );
  }

  /** Records the outcome of a payment against an order already placed. */
  attachPayment(id: string, payment: PaymentIntent): void {
    this._orders.update((orders) =>
      orders.map((order) => (order.id === id ? { ...order, payment } : order)),
    );
  }

  label(stage: OrderStage): string {
    return STAGE_COPY[stage].label;
  }

  /** 0 to 1 across the five stages, for the progress rail. */
  progressOf(order: Order): number {
    return ORDER_STAGES.indexOf(order.stage) / (ORDER_STAGES.length - 1);
  }

  /** Wall-clock minutes until the promised delivery, floored at zero. */
  minutesRemaining(order: Order): number {
    const due = new Date(order.placedAt).getTime() + order.etaMinutes * 60_000;
    return Math.max(0, Math.round((due - Date.now()) / 60_000));
  }

  clearHistory(): void {
    this._orders.set([]);
  }

  /**
   * Advances every active order one stage per interval so tracking visibly
   * moves. A real deployment deletes this and listens to the backend instead.
   */
  private startProgress(): void {
    this.timer = setInterval(() => {
      for (const order of this._orders()) {
        if (order.stage !== 'delivered') {
          this.advance(order.id);
        }
      }
    }, 45_000);
  }

  private restore(): Order[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Order[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

function randomDigits(count: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(count)))
    .map((byte) => byte % 10)
    .join('');
}
