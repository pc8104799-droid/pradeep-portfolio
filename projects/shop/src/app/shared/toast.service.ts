import { Injectable, signal } from '@angular/core';

export interface Toast {
  readonly id: number;
  readonly text: string;
  readonly tone: 'ok' | 'warn' | 'error';
  readonly action?: { readonly label: string; readonly run: () => void };
}

/** Small confirmations — added to cart, coupon applied, payment declined. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private next = 1;
  private readonly _toasts = signal<Toast[]>([]);

  readonly toasts = this._toasts.asReadonly();

  show(text: string, tone: Toast['tone'] = 'ok', action?: Toast['action']): void {
    const toast: Toast = { id: this.next++, text, tone, ...(action ? { action } : {}) };
    this._toasts.update((list) => [...list, toast]);

    setTimeout(() => this.dismiss(toast.id), tone === 'error' ? 6000 : 3200);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
