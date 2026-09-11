import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly body?: string;
  /** An optional inline action, e.g. "View order". */
  readonly action?: { label: string; link: string };
}

const LIFETIME = { success: 3200, info: 3600, warning: 5000, error: 6000 } as const;

/**
 * Transient confirmations.
 *
 * Deliberately not a place for errors that need acting on — a failed save
 * belongs next to the field that failed, not in a corner that disappears. These
 * are for things that succeeded and things the user should merely notice.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<readonly Toast[]>([]);
  private nextId = 1;

  readonly toasts = this._toasts.asReadonly();

  success(title: string, body?: string, action?: Toast['action']): void {
    this.push('success', title, body, action);
  }

  error(title: string, body?: string): void {
    this.push('error', title, body);
  }

  info(title: string, body?: string, action?: Toast['action']): void {
    this.push('info', title, body, action);
  }

  warning(title: string, body?: string): void {
    this.push('warning', title, body);
  }

  dismiss(id: number): void {
    this._toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private push(tone: ToastTone, title: string, body?: string, action?: Toast['action']): void {
    const id = this.nextId++;

    // Three at a time is as many as anyone reads; older ones drop off the top.
    this._toasts.update((toasts) => [...toasts.slice(-2), { id, tone, title, body, action }]);

    setTimeout(() => this.dismiss(id), LIFETIME[tone]);
  }
}
