import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ContentService } from '@pc/core';
import { MagneticDirective } from '@pc/ui';
import { ScrollService } from '@pc/core';
import { Icon } from '@pc/ui';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, MagneticDirective],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  protected readonly scroll = inject(ScrollService);

  private readonly content = inject(ContentService);

  /* Exposed as getters so templates keep plain property access while still
     tracking the underlying signal read. */
  protected get profile() {
    return this.content.profile();
  }

  protected get socials() {
    return this.content.socials();
  }

  protected get navItems() {
    return this.content.nav();
  }

  /** Built once at load — the footer year should never be stale in a long session. */
  protected readonly year = new Date().getFullYear();

  protected go(id: string, event: Event): void {
    event.preventDefault();
    this.scroll.scrollTo(id);
  }
}
