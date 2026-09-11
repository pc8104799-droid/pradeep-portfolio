import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  lazyState,
  NotificationService,
  ToastService,
  type AppNotification,
} from '@pc/medicare-core';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const KINDS = [
  { id: '', label: 'All' },
  { id: 'appointment', label: 'Appointments' },
  { id: 'prescription', label: 'Prescriptions' },
  { id: 'report', label: 'Reports' },
  { id: 'payment', label: 'Payments' },
  { id: 'order', label: 'Orders' },
  { id: 'queue', label: 'Queue' },
] as const;

const ICONS: Record<string, string> = {
  appointment: '◷',
  prescription: '℞',
  report: '⌬',
  payment: '₹',
  order: '⊞',
  queue: '☰',
  consultation: '✚',
  test: '⌬',
  system: 'i',
};

/**
 * The notification feed.
 *
 * Every meaningful event in the workflow writes one of these server-side — a
 * booking confirmed, a prescription issued, a report released, a payment
 * declined — so this page is the single trace of everything that has happened
 * to this account, in order.
 */
@Component({
  selector: 'mc-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Notifications</h1>
          <p>
            @if (notifications.unread(); as unread) {
              {{ unread }} unread
            } @else {
              You are all caught up.
            }
          </p>
        </div>

        <div class="row row--wrap">
          <button
            type="button"
            class="btn btn--outline"
            [disabled]="!notifications.hasUnread() || action.busy()"
            (click)="markAll()"
          >
            Mark all read
          </button>
        </div>
      </header>

      <div class="row row--wrap" role="group" aria-label="Filter notifications">
        @for (option of kinds; track option.id) {
          <button
            type="button"
            class="chip"
            [class.is-active]="kind() === option.id"
            (click)="setKind(option.id)"
          >
            {{ option.label }}
          </button>
        }

        <button type="button" class="chip" [class.is-active]="unreadOnly()" (click)="toggleUnread()">
          Unread only
        </button>
      </div>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="5"
        [skeletonHeight]="3.5"
        emptyTitle="Nothing here"
        [emptyBody]="unreadOnly() ? 'No unread notifications.' : 'Activity on your account will show up here.'"
        (retry)="list.load()"
      >
        <ul class="feed" [class.is-reloading]="list.reloading() || action.busy()">
          @for (item of list.data()?.items ?? []; track item.id) {
            <li class="feed__item" [class.is-unread]="!item.read">
              <span class="feed__icon" [class]="'is-' + item.kind" aria-hidden="true">
                {{ icon(item.kind) }}
              </span>

              <div class="feed__body">
                <div class="feed__top">
                  <strong>{{ item.title }}</strong>
                  <span class="muted text-xs">{{ item.createdAt | when }}</span>
                </div>

                <p>{{ item.body }}</p>

                <div class="feed__actions">
                  @if (item.link) {
                    <a class="btn btn--ghost btn--sm" [routerLink]="link(item)" (click)="markRead(item)">
                      Open →
                    </a>
                  }

                  @if (!item.read) {
                    <button type="button" class="btn btn--ghost btn--sm" (click)="markRead(item)">
                      Mark read
                    </button>
                  }

                  <button type="button" class="btn btn--ghost btn--sm" (click)="remove(item)">
                    Dismiss
                  </button>
                </div>
              </div>
            </li>
          }
        </ul>

        @if (list.data(); as page) {
          <mc-paginator [page]="page.page" [pages]="page.pages" [total]="page.total" (pageChange)="setPage($event)" />
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    .feed {
      display: grid;
      gap: 0.5rem;
    }

    .feed__item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.75rem;
      padding: var(--pad-card);
      border: 1px solid var(--stroke);
      border-radius: var(--radius);
      background: var(--surface);
      transition: border-color var(--t) var(--ease);
    }

    /* Unread carries a coloured rail rather than a different background, so a
       long list does not turn into stripes. */
    .feed__item.is-unread {
      border-left: 3px solid var(--primary);
    }

    .feed__icon {
      display: grid;
      place-items: center;
      width: 2.1rem;
      height: 2.1rem;
      border-radius: var(--radius-pill);
      background: var(--surface-3);
      color: var(--ink-2);
      font-size: 0.95rem;
      flex: none;
    }

    .feed__icon.is-appointment,
    .feed__icon.is-queue {
      background: var(--primary-soft);
      color: var(--primary);
    }

    .feed__icon.is-report,
    .feed__icon.is-test {
      background: var(--success-soft);
      color: var(--success);
    }

    .feed__icon.is-payment {
      background: var(--warning-soft);
      color: var(--warning);
    }

    .feed__icon.is-prescription,
    .feed__icon.is-consultation {
      background: var(--info-soft);
      color: var(--info);
    }

    .feed__body {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }

    .feed__top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--gap-sm);
      flex-wrap: wrap;
    }

    .feed__top strong {
      font-family: var(--font-display);
      font-size: 0.92rem;
    }

    .feed__body p {
      color: var(--ink-2);
      font-size: 0.86rem;
    }

    .feed__actions {
      display: flex;
      gap: 0.15rem;
      flex-wrap: wrap;
      margin-top: 0.25rem;
      margin-left: -0.5rem;
    }
  `,
})
export class NotificationsPage {
  protected readonly notifications = inject(NotificationService);

  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly kinds = KINDS;
  protected readonly kind = signal<string>('');
  protected readonly unreadOnly = signal(false);
  protected readonly page = signal(1);
  protected readonly action = new ActionState();

  private readonly panel = computed(() => (this.auth.role() === 'doctor' ? 'doctor' : 'patient'));

  protected readonly list = lazyState(() =>
    this.notifications.list({
      kind: this.kind(),
      read: this.unreadOnly() ? 'false' : '',
      page: this.page(),
      limit: 15,
      sort: '-createdAt',
    }),
  );

  constructor() {
    void this.list.load();
  }

  protected icon(kind: string): string {
    return ICONS[kind] ?? 'i';
  }

  /**
   * Notification links are written patient-side by the API. A doctor following
   * one needs it pointed at their own panel instead.
   */
  protected link(item: AppNotification): string {
    const link = item.link ?? '/';
    return this.panel() === 'doctor' ? link.replace('/patient/', '/doctor/') : link;
  }

  protected setKind(kind: string): void {
    this.kind.set(kind);
    this.page.set(1);
    void this.list.load();
  }

  protected toggleUnread(): void {
    this.unreadOnly.update((value) => !value);
    this.page.set(1);
    void this.list.load();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.list.load();
  }

  protected async markRead(item: AppNotification): Promise<void> {
    if (item.read) return;

    await this.action.run(() => this.notifications.markRead(item.id));
    void this.list.load();
  }

  protected async markAll(): Promise<void> {
    const result = await this.action.run(() => this.notifications.markAllRead());
    if (result === null) return;

    this.toasts.success(`${result} marked as read`);
    void this.list.load();
  }

  protected async remove(item: AppNotification): Promise<void> {
    await this.action.run(() => this.notifications.remove(item.id));
    void this.list.load();
    void this.notifications.refreshUnread();
  }
}
