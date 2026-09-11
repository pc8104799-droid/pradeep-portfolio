import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService, type QueryInput } from '../api/api.service';
import type { AppNotification, Page } from '../models/medicare.models';

/**
 * Notifications, plus the unread badge in the header.
 *
 * The count is kept in a signal because the header shows it on every screen;
 * it is refreshed after anything that creates a notification rather than being
 * polled, so an idle tab makes no requests.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);

  private readonly _unread = signal(0);
  readonly unread = this._unread.asReadonly();
  readonly hasUnread = computed(() => this._unread() > 0);

  list(query?: QueryInput): Promise<Page<AppNotification> & { unread: number }> {
    return this.api
      .get<Page<AppNotification> & { unread: number }>('/notifications', query)
      .then((page) => {
        this._unread.set(page.unread);
        return page;
      });
  }

  async refreshUnread(): Promise<number> {
    try {
      const { count } = await this.api.get<{ count: number }>('/notifications/unread-count');
      this._unread.set(count);
      return count;
    } catch {
      // The badge is not worth surfacing an error for.
      return this._unread();
    }
  }

  async markRead(id: string): Promise<void> {
    await this.api.post(`/notifications/${id}/read`);
    this._unread.update((count) => Math.max(0, count - 1));
  }

  async markAllRead(): Promise<number> {
    const { updated } = await this.api.post<{ updated: number }>('/notifications/read-all');
    this._unread.set(0);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`/notifications/${id}`);
  }

  /** Called on sign-out so the next account does not inherit a badge. */
  reset(): void {
    this._unread.set(0);
  }
}
