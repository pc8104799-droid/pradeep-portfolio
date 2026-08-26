import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, ThemeService } from '@pc/core';
import { CartService, CatalogService } from '@pc/shop-core';
import { RupeesPipe } from '../shared/rupees.pipe';

/**
 * Sticky header: brand, service-area picker, search, theme, account and the
 * cart. Search submits to /menu so the results are a real, shareable URL.
 */
@Component({
  selector: 'shop-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RupeesPipe],
  templateUrl: './shop-header.html',
  styleUrl: './shop-header.scss',
  host: { '[class.is-menu-open]': 'menuOpen()' },
})
export class ShopHeader {
  protected readonly catalog = inject(CatalogService);
  protected readonly cart = inject(CartService);
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly menuOpen = signal(false);
  protected readonly areaOpen = signal(false);
  protected readonly area = signal(this.catalog.config().serviceAreas[0]);

  protected readonly config = computed(() => this.catalog.config());

  protected readonly foodCategories = computed(() => this.catalog.categoriesFor('food'));
  protected readonly groceryCategories = computed(() => this.catalog.categoriesFor('grocery'));

  protected search(event: Event): void {
    event.preventDefault();
    const q = this.query().trim();

    this.router.navigate(['/menu'], { queryParams: q ? { q } : {} });
    this.menuOpen.set(false);
  }

  protected chooseArea(area: string): void {
    this.area.set(area);
    this.areaOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    this.auth.logout();
    this.menuOpen.set(false);
    await this.router.navigateByUrl('/');
  }
}
