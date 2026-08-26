import { computed, Injectable, signal } from '@angular/core';
import BUNDLED from '../data/catalog.json';
import type {
  Catalog,
  Category,
  DietTag,
  Kitchen,
  Product,
  ProductKind,
  Variant,
} from '../models/shop.models';

const CATALOG_URL = 'catalog.json';

/** Everything a listing page can narrow by. */
export interface ProductQuery {
  readonly kind?: ProductKind | 'all';
  readonly categoryId?: string | null;
  readonly kitchenId?: string | null;
  readonly search?: string;
  readonly diet?: DietTag | 'all';
  readonly maxPrice?: number | null;
  readonly sort?: 'relevance' | 'price-asc' | 'price-desc' | 'rating' | 'name';
  readonly bestsellerOnly?: boolean;
}

/** The bundled catalog, exported for tests and tooling. */
export const BUNDLED_CATALOG = BUNDLED as unknown as Catalog;

/**
 * Read model for the whole store.
 *
 * The catalog is fetched at startup and falls back to the copy compiled into the
 * bundle, so the storefront renders even if the file is missing. Nothing here
 * mutates: carts and orders are separate services.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly _catalog = signal<Catalog>(BUNDLED_CATALOG);
  private readonly _loaded = signal(false);

  readonly catalog = this._catalog.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly config = computed(() => this._catalog().config);
  readonly categories = computed(() => this._catalog().categories);
  readonly kitchens = computed(() => this._catalog().kitchens);
  readonly products = computed(() => this._catalog().products);
  readonly coupons = computed(() => this._catalog().coupons);
  readonly slots = computed(() => this._catalog().slots);

  readonly bestsellers = computed(() => this.products().filter((product) => product.bestseller));

  /** Fast lookups, rebuilt only when the catalog itself changes. */
  private readonly index = computed(() => ({
    products: new Map(this.products().map((product) => [product.id, product])),
    categories: new Map(this.categories().map((category) => [category.id, category])),
    kitchens: new Map(this.kitchens().map((kitchen) => [kitchen.id, kitchen])),
  }));

  async load(): Promise<void> {
    try {
      const response = await fetch(CATALOG_URL, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const incoming = (await response.json()) as Partial<Catalog>;
      // Merge so a trimmed or older file cannot empty out a whole section.
      this._catalog.set({ ...BUNDLED_CATALOG, ...incoming });
    } catch {
      this._catalog.set(BUNDLED_CATALOG);
    } finally {
      this._loaded.set(true);
    }
  }

  product(id: string): Product | undefined {
    return this.index().products.get(id);
  }

  category(id: string): Category | undefined {
    return this.index().categories.get(id);
  }

  kitchen(id: string): Kitchen | undefined {
    return this.index().kitchens.get(id);
  }

  variant(productId: string, variantId: string): Variant | undefined {
    return this.product(productId)?.variants.find((entry) => entry.id === variantId);
  }

  categoriesFor(kind: ProductKind): Category[] {
    return this.categories().filter((category) => category.kind === kind);
  }

  /** Cheapest in-stock variant — what a listing card shows. */
  fromPrice(product: Product): number {
    const inStock = product.variants.filter((variant) => variant.inStock);
    const pool = inStock.length ? inStock : product.variants;
    return Math.min(...pool.map((variant) => variant.price));
  }

  /** Highest MRP against the cheapest price, for the "save X%" badge. */
  discountPercent(product: Product): number {
    const variant =
      product.variants.find((entry) => entry.price === this.fromPrice(product)) ??
      product.variants[0];

    if (!variant?.mrp || variant.mrp <= variant.price) {
      return 0;
    }

    return Math.round(((variant.mrp - variant.price) / variant.mrp) * 100);
  }

  /** Products a customer also tends to buy — same category, excluding itself. */
  related(product: Product, limit = 6): Product[] {
    return this.products()
      .filter((entry) => entry.id !== product.id && entry.categoryId === product.categoryId)
      .slice(0, limit);
  }

  /**
   * The single place listing pages narrow the catalog. Kept here rather than in
   * a component so the home page, category pages and search all rank the same
   * way.
   */
  search(query: ProductQuery): Product[] {
    const {
      kind = 'all',
      categoryId = null,
      kitchenId = null,
      search = '',
      diet = 'all',
      maxPrice = null,
      sort = 'relevance',
      bestsellerOnly = false,
    } = query;

    const needle = search.trim().toLowerCase();

    const matched = this.products().filter((product) => {
      if (kind !== 'all' && product.kind !== kind) return false;
      if (categoryId && product.categoryId !== categoryId) return false;
      if (kitchenId && product.kitchenId !== kitchenId) return false;
      if (bestsellerOnly && !product.bestseller) return false;

      // "veg" hides egg as well, which is what shoppers expect from the toggle.
      if (diet === 'veg' && product.diet !== 'veg') return false;
      if (diet !== 'all' && diet !== 'veg' && product.diet !== diet) return false;

      if (maxPrice !== null && this.fromPrice(product) > maxPrice) return false;

      if (needle) {
        const haystack = [
          product.name,
          product.summary,
          product.tags.join(' '),
          this.category(product.categoryId)?.name ?? '',
          product.kitchenId ? (this.kitchen(product.kitchenId)?.name ?? '') : '',
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(needle)) return false;
      }

      return true;
    });

    return this.sortProducts(matched, sort, needle);
  }

  private sortProducts(products: Product[], sort: string, needle: string): Product[] {
    const sorted = [...products];

    switch (sort) {
      case 'price-asc':
        return sorted.sort((a, b) => this.fromPrice(a) - this.fromPrice(b));
      case 'price-desc':
        return sorted.sort((a, b) => this.fromPrice(b) - this.fromPrice(a));
      case 'rating':
        return sorted.sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount);
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      default:
        // Relevance: an exact name hit first, then bestsellers, then rating.
        return sorted.sort((a, b) => {
          if (needle) {
            const aHit = a.name.toLowerCase().startsWith(needle) ? 1 : 0;
            const bHit = b.name.toLowerCase().startsWith(needle) ? 1 : 0;
            if (aHit !== bHit) return bHit - aHit;
          }

          if (a.bestseller !== b.bestseller) return a.bestseller ? -1 : 1;
          return b.rating - a.rating;
        });
    }
  }
}
