import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ActionState,
  CatalogService,
  lazyState,
  ToastService,
  type Medicine,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { Modal } from '../../shared/ui/dialogs';
import { InrPipe, MC_PIPES } from '../../shared/pipes';

const VIEWS = [
  { id: 'low', label: 'Needs attention' },
  { id: 'out', label: 'Out of stock' },
  { id: 'expiring', label: 'Expiring soon' },
  { id: 'all', label: 'Everything' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

/** Anything at or below this is worth reordering. */
const LOW_STOCK = 25;

/**
 * Stock control.
 *
 * Deliberately narrow: quantity, price and expiry are what a pharmacist owns at
 * the counter. Renaming a medicine or changing whether it needs a prescription
 * is a regulatory decision, so the API refuses those fields and this screen
 * does not offer them.
 *
 * The default view is "needs attention" rather than the full catalogue — a
 * stock screen that opens on 46 healthy lines buries the four that matter.
 */
@Component({
  selector: 'mc-inventory-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, Modal, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  templateUrl: './inventory-page.html',
  styleUrl: './inventory-page.scss',
})
export class InventoryPage {
  private readonly catalog = inject(CatalogService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  /** The toast needs a formatted price, and a toast cannot use a template pipe. */
  private readonly rupees = new InrPipe();

  protected readonly views = VIEWS;
  protected readonly lowStock = LOW_STOCK;
  protected readonly view = signal<ViewId>('low');
  protected readonly search = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  protected readonly action = new ActionState();

  /** The whole catalogue: 46 lines is small enough to filter in the browser. */
  protected readonly medicines = lazyState(() =>
    this.catalog.medicines({ q: this.search(), limit: 200, sort: 'name' }),
  );

  /* ------------------------------------------------------ the edit form */

  protected readonly editing = signal<Medicine | null>(null);
  protected readonly stock = signal(0);
  protected readonly price = signal(0);
  protected readonly expiryDate = signal('');

  /** Ninety days out — the line between "fine" and "use it or lose it". */
  private readonly expirySoon = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

  protected readonly rows = computed(() => {
    const all = this.medicines.data()?.items ?? [];

    switch (this.view()) {
      case 'out':
        return all.filter((row) => row.stock === 0);
      case 'expiring':
        return all.filter((row) => row.expiryDate <= this.expirySoon);
      case 'low':
        return all
          .filter((row) => row.stock < LOW_STOCK || row.expiryDate <= this.expirySoon)
          .sort((a, b) => a.stock - b.stock);
      default:
        return all;
    }
  });

  protected readonly totals = computed(() => {
    const all = this.medicines.data()?.items ?? [];

    return {
      lines: all.length,
      out: all.filter((row) => row.stock === 0).length,
      low: all.filter((row) => row.stock > 0 && row.stock < LOW_STOCK).length,
      expiring: all.filter((row) => row.expiryDate <= this.expirySoon).length,
      value: all.reduce((sum, row) => sum + row.price * row.stock, 0),
    };
  });

  constructor() {
    void this.medicines.load();
  }

  protected setView(view: ViewId): void {
    this.view.set(view);
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    void this.medicines.load();
  }

  protected isExpiring(medicine: Medicine): boolean {
    return medicine.expiryDate <= this.expirySoon;
  }

  protected open(medicine: Medicine): void {
    this.editing.set(medicine);
    this.stock.set(medicine.stock);
    this.price.set(medicine.price);
    this.expiryDate.set(medicine.expiryDate);
    this.action.clear();
  }

  /** The quick "+50 units" buttons, which is how restocking actually happens. */
  protected addStock(amount: number): void {
    this.stock.update((current) => Math.max(0, current + amount));
  }

  protected async save(): Promise<void> {
    const medicine = this.editing();
    if (!medicine) return;

    const saved = await this.action.run(() =>
      this.catalog.updateMedicine(medicine.id, {
        stock: this.stock(),
        price: this.price(),
        expiryDate: this.expiryDate(),
      }),
    );

    if (!saved) return;

    this.editing.set(null);
    this.toasts.success(
      `${saved.name} updated`,
      `${saved.stock} in stock · ${this.rupees.transform(saved.price)}`,
    );

    void this.medicines.load();
  }
}
