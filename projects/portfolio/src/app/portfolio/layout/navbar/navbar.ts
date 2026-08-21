import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ContentService } from '@pc/core';
import { ScrollService } from '@pc/core';
import { ThemeService } from '@pc/core';
import { Icon } from '@pc/ui';
import { MagneticDirective } from '@pc/ui';

/**
 * Sticky glass navigation. The active link is driven by ScrollService, and the
 * highlight pill is positioned with a CSS transition on the anchor itself rather
 * than a measured slider, so it survives resize without any layout maths.
 */
@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, MagneticDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  host: {
    '[class.is-stuck]': 'scroll.scrolled()',
    '[class.is-open]': 'menuOpen()',
  },
})
export class Navbar {
  protected readonly scroll = inject(ScrollService);
  protected readonly theme = inject(ThemeService);

  private readonly content = inject(ContentService);

  /* Exposed as getters so templates keep plain property access while still
     tracking the underlying signal read. */
  protected get navItems() {
    return this.content.nav();
  }

  protected get profile() {
    return this.content.profile();
  }

  protected readonly menuOpen = signal(false);

  protected go(id: string, event: Event): void {
    event.preventDefault();
    this.menuOpen.set(false);
    this.scroll.scrollTo(id);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
