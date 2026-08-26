import { inject, Injectable, signal } from '@angular/core';
import type { PaymentIntent, PaymentMethod } from '../models/shop.models';
import { CatalogService } from './catalog.service';

export interface CardDetails {
  readonly number: string;
  readonly name: string;
  readonly expiry: string;
  readonly cvv: string;
}

export interface CardCheck {
  readonly ok: boolean;
  readonly brand: string;
  readonly errors: Readonly<Record<string, string>>;
}

/**
 * Payments.
 *
 * UPI is real: `buildUpiUri` produces a standards-compliant `upi://pay` intent
 * that any UPI app will open, paying the VPA in `config.upiId`. Nothing about
 * that needs a server.
 *
 * Card and net-banking are SIMULATED. A real gateway (Razorpay, Stripe, PayU)
 * needs a secret key to create an order and verify the signature, and that key
 * cannot live in browser code — so the card path here validates input properly
 * and then resolves against a local sandbox. The `settle` seam is where a real
 * provider drops in once there is a backend to talk to.
 *
 * Neither can *confirm* receipt of money without a server callback, so an order
 * paid by UPI is recorded as pending until it is confirmed out of band.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly catalog = inject(CatalogService);

  /** The intent currently on screen. */
  private readonly _intent = signal<PaymentIntent | null>(null);
  readonly intent = this._intent.asReadonly();

  readonly busy = signal(false);

  /** False until a UPI VPA is configured, which gates the QR. */
  upiConfigured(): boolean {
    return this.catalog.config().upiId.trim().length > 0;
  }

  /**
   * Builds the UPI deep link. Amount is fixed to two decimals and the note is
   * URL-encoded, both of which UPI apps are strict about.
   */
  buildUpiUri(amount: number, note: string): string {
    const config = this.catalog.config();
    const params = new URLSearchParams({
      pa: config.upiId,
      pn: config.upiPayeeName,
      am: amount.toFixed(2),
      cu: config.currency,
      tn: note,
    });

    return `upi://pay?${params.toString()}`;
  }

  /** Opens an intent for the chosen method. UPI also carries the deep link. */
  start(method: PaymentMethod, amount: number, note: string): PaymentIntent {
    const intent: PaymentIntent = {
      id: `pay_${randomId()}`,
      method,
      amount,
      status: method === 'cod' ? 'cash-on-delivery' : 'pending',
      ...(method === 'upi' && this.upiConfigured()
        ? { upiUri: this.buildUpiUri(amount, note) }
        : {}),
      createdAt: new Date().toISOString(),
      ...(method === 'upi'
        ? { note: 'Awaiting confirmation from your UPI app.' }
        : method === 'cod'
          ? { note: 'Pay the rider on delivery.' }
          : { note: 'Sandbox card flow — no money moves.' }),
    };

    this._intent.set(intent);
    return intent;
  }

  /**
   * Validates a card locally: Luhn, expiry in the future, CVV length by brand.
   * This is the same checking a real integration does before it ever calls the
   * gateway, so none of it is wasted when a backend arrives.
   */
  checkCard(card: CardDetails): CardCheck {
    const digits = card.number.replace(/\s+/g, '');
    const errors: Record<string, string> = {};
    const brand = detectBrand(digits);

    if (!/^\d{13,19}$/.test(digits)) {
      errors['number'] = 'A card number is 13 to 19 digits.';
    } else if (!luhn(digits)) {
      errors['number'] = 'That card number fails its checksum.';
    }

    if (card.name.trim().length < 3) {
      errors['name'] = 'Enter the name printed on the card.';
    }

    const expiry = card.expiry.trim();
    const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry);
    if (!match) {
      errors['expiry'] = 'Use MM/YY.';
    } else {
      const month = Number(match[1]);
      const year = 2000 + Number(match[2]);
      const now = new Date();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);

      if (month < 1 || month > 12) {
        errors['expiry'] = 'Month must be 01 to 12.';
      } else if (endOfMonth < now) {
        errors['expiry'] = 'That card has expired.';
      }
    }

    const cvvLength = brand === 'Amex' ? 4 : 3;
    if (!new RegExp(`^\\d{${cvvLength}}$`).test(card.cvv.trim())) {
      errors['cvv'] = `CVV is ${cvvLength} digits for ${brand === 'Unknown' ? 'this card' : brand}.`;
    }

    return { ok: Object.keys(errors).length === 0, brand, errors };
  }

  /**
   * Settles the open intent.
   *
   * The sandbox is deliberately not always-successful: a card ending 0000 fails,
   * so the failure path in the UI is exercised. Replace this method body with a
   * call to your backend to go live.
   */
  async settle(options: { card?: CardDetails } = {}): Promise<PaymentIntent> {
    const intent = this._intent();
    if (!intent) {
      throw new Error('No payment has been started.');
    }

    this.busy.set(true);

    try {
      await delay(900);

      if (intent.method === 'card') {
        const digits = (options.card?.number ?? '').replace(/\s+/g, '');
        const declined = digits.endsWith('0000');

        return this.finish({
          ...intent,
          status: declined ? 'failed' : 'paid',
          reference: declined ? undefined : `sandbox_${randomId()}`,
          note: declined
            ? 'Declined by the sandbox issuer. Cards ending 0000 always decline.'
            : 'Sandbox payment captured — no real money moved.',
        });
      }

      if (intent.method === 'upi') {
        // Without a server callback the app cannot know the transfer landed, so
        // the customer confirms and the order is marked pending verification.
        return this.finish({
          ...intent,
          status: 'pending',
          note: 'Marked as paid by you. Verify in your UPI app before dispatch.',
        });
      }

      return this.finish({ ...intent, status: 'cash-on-delivery' });
    } finally {
      this.busy.set(false);
    }
  }

  /** Customer says the UPI transfer went through. */
  async confirmUpi(reference: string): Promise<PaymentIntent> {
    const intent = this._intent();
    if (!intent) {
      throw new Error('No payment has been started.');
    }

    await delay(400);

    return this.finish({
      ...intent,
      status: 'paid',
      reference: reference.trim() || undefined,
      note: 'Confirmed by the customer. Check the UPI reference against your statement.',
    });
  }

  reset(): void {
    this._intent.set(null);
  }

  private finish(intent: PaymentIntent): PaymentIntent {
    this._intent.set(intent);
    return intent;
  }
}

/* --------------------------------------------------------------- helpers */

function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let value = digits.charCodeAt(i) - 48;

    if (double) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }

    sum += value;
    double = !double;
  }

  return sum % 10 === 0;
}

function detectBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^(60|65|81|82|508)/.test(digits)) return 'RuPay';
  if (/^6/.test(digits)) return 'Discover';
  return 'Unknown';
}

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 14);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
