import { inject, Injectable } from '@angular/core';
import { ApiService, type QueryInput } from '../api/api.service';
import { ApiError } from '../api/api-error';
import type { Page, Payment, PaymentMethod, Receipt } from '../models/medicare.models';

/**
 * Payments.
 *
 * No money moves — the server decides the outcome and updates whatever the
 * payment was attached to. The `simulate` flag is how the demo shows a declined
 * card, which is the failure path every payment screen has to handle and almost
 * no demo ever shows.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly api = inject(ApiService);

  list(query?: QueryInput): Promise<Page<Payment>> {
    return this.api.get('/payments', query);
  }

  get(id: string): Promise<Payment> {
    return this.api.get(`/payments/${id}`);
  }

  /**
   * Settles a payment.
   *
   * A decline comes back as a 402, which is a real failure for HTTP but an
   * expected outcome here — so it is unwrapped into the same shape as success
   * and the caller branches on `status` rather than on a thrown error.
   */
  async pay(
    id: string,
    method: PaymentMethod,
    simulate: 'success' | 'failure' = 'success',
  ): Promise<{ payment: Payment; declined: boolean; message: string | null }> {
    try {
      const { payment } = await this.api.post<{ payment: Payment }>(`/payments/${id}/pay`, {
        method,
        simulate,
      });

      return { payment, declined: false, message: null };
    } catch (error) {
      if (error instanceof ApiError && error.status === 402) {
        const payment = await this.get(id);
        return { payment, declined: true, message: error.message };
      }

      throw error;
    }
  }

  receipt(id: string): Promise<Receipt> {
    return this.api.get(`/payments/${id}/receipt`);
  }
}
