import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogService, type DietTag, type ProductKind } from '@pc/shop-core';
import { ProductCard } from '../shared/product-card';
import { RupeesPipe } from '../shared/rupees.pipe';

type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'rating' | 'name';

/**
 * The browse page. Category comes from the path, the search term from the query
 * string — both shareable — while the narrowing controls are local state.
 */
@Component({
  selector: 'shop-catalog-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductCard, RupeesPipe],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.scss',
})
export class CatalogPage {
  protected readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });

  protected readonly categoryId = computed(() => this.params().get('categoryId'));
  protected readonly term = computed(() => this.queryParams().get('q') ?? '');

  /** `kind` narrows to food or groceries when no category is selected. */
  protected readonly kind = computed<ProductKind | 'all'>(() => {
    const fromQuery = this.queryParams().get('kind');
    if (fromQuery === 'food' || fromQuery === 'grocery') {
      return fromQuery;
    }

    const category = this.categoryId() ? this.catalog.category(this.categoryId()!) : null;
    return category?.kind ?? 'all';
  });

  protected readonly diet = signal<DietTag | 'all'>('all');
  protected readonly sort = signal<SortKey>('relevance');
  protected readonly maxPrice = signal<number | null>(null);
  protected readonly filtersOpen = signal(false);

  protected readonly category = computed(() =>
    this.categoryId() ? (this.catalog.category(this.categoryId()!) ?? null) : null,
  );

  protected readonly heading = computed(() => {
    const category = this.category();
    if (category) return category.name;
    if (this.term()) return `Results for “${this.term()}”`;
    if (this.kind() === 'food') return 'All food';
    if (this.kind() === 'grocery') return 'All groceries';
    return 'Everything in store';
  });

  protected readonly results = computed(() =>
    this.catalog.search({
      kind: this.kind(),
      categoryId: this.categoryId(),
      search: this.term(),
      diet: this.diet(),
      maxPrice: this.maxPrice(),
      sort: this.sort(),
    }),
  );

  /** Price ceilings offered as chips, derived from what is actually in stock. */
  protected readonly priceSteps = computed(() => {
    const prices = this.catalog
      .search({ kind: this.kind(), categoryId: this.categoryId() })
      .map((product) => this.catalog.fromPrice(product));

    if (!prices.length) {
      return [];
    }

    const max = Math.max(...prices);
    return [99, 199, 299, 499, 999].filter((step) => step < max);
  });

  protected readonly siblingCategories = computed(() =>
    this.kind() === 'all' ? this.catalog.categories() : this.catalog.categoriesFor(this.kind() as ProductKind),
  );

  protected readonly activeFilterCount = computed(
    () => (this.diet() !== 'all' ? 1 : 0) + (this.maxPrice() !== null ? 1 : 0),
  );

  protected setSort(value: string): void {
    this.sort.set(value as SortKey);
  }

  protected toggleDiet(value: DietTag): void {
    this.diet.update((current) => (current === value ? 'all' : value));
  }

  protected setMaxPrice(value: number): void {
    this.maxPrice.update((current) => (current === value ? null : value));
  }

  protected clearFilters(): void {
    this.diet.set('all');
    this.maxPrice.set(null);
    this.sort.set('relevance');
  }

  protected clearSearch(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }
}
