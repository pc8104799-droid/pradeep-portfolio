import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  lazyState,
  PharmacyService,
  ToastService,
  type MedicineOrder,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { ConfirmService } from '../../shared/ui/dialogs';
import { MC_PIPES } from '../../shared/pipes';

const TABS = [
  { id: 'open', label: 'To dispense' },
  { id: 'ready', label: 'Ready & on the way' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'all', label: 'All' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Which stages each tab covers. */
const TAB_STAGES: Record<TabId, readonly string[]> = {
  open: ['placed', 'confirmed', 'preparing'],
  ready: ['ready-for-pickup', 'out-for-delivery'],
  delivered: ['delivered'],
  all: [],
};

/**
 * The dispensing queue.
 *
 * The pharmacy's working screen, sorted oldest first — the opposite of the
 * patient's order list, because the question here is "who has been waiting
 * longest", not "what did I just order".
 *
 * Each row can be pushed to its next stage in place. An order that is unpaid or
 * missing a prescription is called out rather than silently left in the list,
 * since those are the two reasons a bag does not go out.
 */
@Component({
  selector: 'mc-pharmacy-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  templateUrl: './queue-page.html',
  styleUrl: './queue-page.scss',
})
export class PharmacyQueuePage {
  private readonly pharmacy = inject(PharmacyService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);

  protected readonly tabs = TABS;
  protected readonly tab = signal<TabId>('open');
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly action = new ActionState();

  /** Reception mounts this page too, under its own prefix. */
  protected readonly panel = computed(() => this.auth.panel());

  protected readonly list = lazyState(() =>
    this.pharmacy.orders({
      q: this.search(),
      page: this.page(),
      limit: 15,
      // Oldest first while there is work to do; newest first once it is done.
      sort: this.tab() === 'delivered' ? '-placedAt' : 'placedAt',
    }),
  );

  /**
   * Stage filtering happens here rather than on the server because a tab spans
   * several stages, and the shared list pipeline only does equality.
   */
  protected readonly orders = computed(() => {
    const stages = TAB_STAGES[this.tab()];
    const rows = this.list.data()?.items ?? [];

    if (!stages.length) return rows;
    return rows.filter((order) => stages.includes(order.stage));
  });

  protected readonly blocked = computed(() =>
    this.orders().filter(
      (order) => order.paymentStatus !== 'successful' || order.prescriptionStatus === 'required',
    ).length,
  );

  constructor() {
    void this.list.load();
  }

  protected setTab(tab: TabId): void {
    this.tab.set(tab);
    this.page.set(1);
    void this.list.load();
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    void this.list.load();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.list.load();
  }

  /** What this order is waiting on, if anything. */
  protected holdReason(order: MedicineOrder): string | null {
    if (order.paymentStatus !== 'successful') return 'Awaiting payment';
    if (order.prescriptionStatus === 'required') return 'Prescription not verified';
    return null;
  }

  protected nextLabel(order: MedicineOrder): string | null {
    const next: Record<string, string> = {
      placed: 'Confirm',
      confirmed: 'Start preparing',
      preparing: 'Mark ready',
      'ready-for-pickup': 'Send out',
      'out-for-delivery': 'Mark delivered',
    };

    return next[order.stage] ?? null;
  }

  protected async advance(order: MedicineOrder): Promise<void> {
    const hold = this.holdReason(order);

    if (hold) {
      this.toasts.warning(`${order.id} is on hold`, hold);
      return;
    }

    const updated = await this.action.run(() => this.pharmacy.advanceOrder(order.id));
    if (!updated) {
      this.toasts.error('Could not update the order', this.action.error()?.message);
      return;
    }

    this.toasts.success(
      `${order.id} → ${updated.stage.replaceAll('-', ' ')}`,
      'The patient has been notified.',
    );
    void this.list.load();
  }

  protected async cancel(order: MedicineOrder): Promise<void> {
    const agreed = await this.confirm.ask({
      heading: `Cancel order ${order.id}?`,
      body: 'The stock is returned to the shelf and any payment is refunded.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });

    if (!agreed) return;

    const updated = await this.action.run(() => this.pharmacy.cancelOrder(order.id));
    if (!updated) {
      this.toasts.error('Could not cancel', this.action.error()?.message);
      return;
    }

    this.toasts.success(`${order.id} cancelled`, 'Stock returned.');
    void this.list.load();
  }
}
