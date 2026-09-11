import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  CatalogService,
  lazyState,
  PharmacyService,
  ToastService,
  type Medicine,
  type MedicineQuery,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const SORTS = [
  { id: 'name', label: 'Name A–Z' },
  { id: 'price', label: 'Price: low to high' },
  { id: '-price', label: 'Price: high to low' },
  { id: '-discount', label: 'Biggest discount' },
  { id: '-rating', label: 'Best rated' },
];

/**
 * The hospital medical store.
 *
 * Prescription-only medicines are shown, not hidden — a patient should be able
 * to check the price and the stock of what they have been prescribed. What they
 * cannot do is add one to the basket until a valid prescription is attached,
 * and the card says exactly that rather than silently disabling a button.
 *
 * The pharmacy desk mounts the same page to see exactly what a patient sees,
 * minus the basket: checking how a medicine looks on the shelf is a different
 * question from restocking it, which is what the inventory screen is for.
 */
@Component({
  selector: 'mc-pharmacy-catalogue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  templateUrl: './catalogue-page.html',
  styleUrl: './catalogue-page.scss',
})
export class CataloguePage {
  protected readonly catalog = inject(CatalogService);
  protected readonly cart = inject(PharmacyService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly sorts = SORTS;
  protected readonly action = new ActionState();

  /** Only a patient has a basket; staff are here to look. */
  protected readonly canBuy = computed(() => this.auth.panel() === 'patient');

  /** Where a medicine card links to, which differs per panel. */
  protected readonly base = computed(() =>
    this.canBuy() ? '/patient/pharmacy' : '/pharmacy/catalogue',
  );

  protected readonly filters = signal<MedicineQuery>(this.readQuery());

  protected readonly results = lazyState(() => this.catalog.medicines(this.filters()));

  /** The prescription currently unlocking Rx-only lines, if any. */
  protected readonly prescriptionId = computed(() => this.cart.prescriptionId());

  constructor() {
    void this.catalog.loadReference().catch(() => undefined);
    void this.results.load();

    // Arriving from "order these medicines" fills the basket straight away.
    const fromPrescription = this.route.snapshot.queryParamMap.get('prescriptionId');
    if (fromPrescription) void this.loadPrescription(fromPrescription);
  }

  protected patch(change: Partial<MedicineQuery>): void {
    const next = { ...this.filters(), ...change, page: change.page ?? 1 };
    this.filters.set(next);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: clean(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    void this.results.load();
  }

  protected clearFilters(): void {
    this.patch({ q: '', category: '', form: '', maxPrice: undefined, inStock: undefined, sort: 'name' });
  }

  /** Whether this medicine can go in the basket right now, and why not. */
  protected blockedReason(medicine: Medicine): string | null {
    if (medicine.stock <= 0) return 'Out of stock';
    if (medicine.prescriptionRequired && !this.prescriptionId()) return 'Prescription required';
    return null;
  }

  protected add(medicine: Medicine): void {
    const blocked = this.blockedReason(medicine);

    if (blocked === 'Prescription required') {
      this.toasts.warning(
        `${medicine.name} needs a prescription`,
        'Open a prescription and use "Order these medicines" to unlock it.',
      );
      return;
    }

    if (blocked) {
      this.toasts.error(`${medicine.name} is out of stock`);
      return;
    }

    this.cart.add(medicine.id);
    this.toasts.success(`${medicine.name} added`, `${this.cart.count()} items in your basket`, {
      label: 'View basket',
      link: '/patient/pharmacy/cart',
    });
  }

  protected async loadPrescription(prescriptionId: string): Promise<void> {
    const basket = await this.action.run(() => this.cart.fromPrescription(prescriptionId));
    if (!basket) {
      this.toasts.error('Could not read that prescription', this.action.error()?.message);
      return;
    }

    this.cart.loadPrescription(basket);

    const unavailable = basket.unavailable.length;
    this.toasts.success(
      `${basket.lines.length} medicine${basket.lines.length === 1 ? '' : 's'} added`,
      unavailable
        ? `${unavailable} not stocked here: ${basket.unavailable.map((line) => line.name).join(', ')}`
        : 'Prescription verified — Rx-only items are unlocked.',
      { label: 'Go to basket', link: '/patient/pharmacy/cart' },
    );
  }

  private readQuery(): MedicineQuery {
    const params = this.route.snapshot.queryParamMap;

    return {
      q: params.get('q') ?? '',
      category: params.get('category') ?? '',
      form: params.get('form') ?? '',
      maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
      inStock: params.get('inStock') === 'true' ? true : undefined,
      sort: params.get('sort') ?? 'name',
      page: Number(params.get('page') ?? 1),
      limit: 12,
    };
  }
}

function clean(query: MedicineQuery): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === '' || value === null || value === undefined || key === 'limit') continue;
    if (key === 'page' && value === 1) continue;
    result[key] = value as string | number | boolean;
  }

  return result;
}
