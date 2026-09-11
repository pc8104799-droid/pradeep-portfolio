import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, CatalogService, lazyState, PharmacyService, StatsService } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CHARTS } from '../../shared/ui/charts';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * The pharmacy counter's home screen.
 *
 * Two questions, in the order a pharmacist asks them: what is waiting to be
 * dispensed right now, and what is about to run out. Revenue is real but comes
 * last — it is a number to report, not a number to act on.
 */
@Component({
  selector: 'mc-pharmacy-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CHARTS, ...MC_PIPES],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class PharmacyDashboardPage {
  private readonly stats = inject(StatsService);
  private readonly pharmacy = inject(PharmacyService);
  private readonly catalog = inject(CatalogService);

  protected readonly auth = inject(AuthService);

  protected readonly dashboard = lazyState(() => this.stats.pharmacy());

  /** The oldest unfulfilled orders — the ones that have been waiting longest. */
  protected readonly waiting = lazyState(() =>
    this.pharmacy.orders({ limit: 60, sort: 'placedAt' }),
  );

  /** Everything at or near zero, cheapest fix first. */
  protected readonly lowStock = lazyState(() =>
    this.catalog.medicines({ limit: 100, sort: 'name' }),
  );

  protected readonly toDispense = computed(() =>
    (this.waiting.data()?.items ?? [])
      .filter((order) => !['delivered', 'cancelled'].includes(order.stage))
      .slice(0, 6),
  );

  protected readonly needsRestock = computed(() =>
    (this.lowStock.data()?.items ?? [])
      .filter((medicine) => medicine.stock < 25)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8),
  );

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  constructor() {
    void this.dashboard.load();
    void this.waiting.load();
    void this.lowStock.load();
  }

  protected reload(): void {
    void this.dashboard.load();
    void this.waiting.load();
    void this.lowStock.load();
  }
}
