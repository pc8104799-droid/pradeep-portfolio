import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, ContentService, ThemeService, type PortfolioContent } from '@pc/core';
import { Icon } from '@pc/ui';
import { DASHBOARD_PAGES } from './dashboard-nav';

/**
 * The workspace chrome: header across the top, the resume sections down the
 * left, a status bar at the bottom. Only the centre pane swaps as you move
 * between sections — each one is a child route rendered into the outlet.
 */
@Component({
  selector: 'app-dashboard-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './dashboard-shell.html',
  styleUrl: './dashboard-shell.scss',
  host: {
    '[class.is-nav-open]': 'navOpen()',
  },
})
export class DashboardShell {
  protected readonly content = inject(ContentService);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  private readonly router = inject(Router);

  protected readonly pages = DASHBOARD_PAGES;
  protected readonly navOpen = signal(false);
  protected readonly menuOpen = signal(false);

  /** Initials for the account chip. */
  protected readonly initials = computed(() => {
    const name = this.auth.user()?.name ?? '';
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?'
    );
  });

  /** How many entries sit behind each nav item. */
  protected readonly counts = computed(() => {
    const content = this.content.content();

    return Object.fromEntries(
      DASHBOARD_PAGES.map((page) => {
        const total = page.editors.reduce((sum, id) => {
          const branch = (content as unknown as Record<string, unknown>)[BRANCH_OF[id] ?? ''];
          return sum + (Array.isArray(branch) ? branch.length : 0);
        }, 0);

        return [page.id, total || null];
      }),
    ) as Record<string, number | null>;
  });

  protected readonly sourceLabel = computed(() => {
    switch (this.content.source()) {
      case 'local-edits':
        return 'Unsaved edits in this browser';
      case 'file':
        return 'Loaded from content.json';
      default:
        return 'Using the bundled content';
    }
  });

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}

/** Schema section id -> the content branch it counts. */
const BRANCH_OF: Record<string, keyof PortfolioContent> = {
  stats: 'stats',
  services: 'services',
  'core-stack': 'coreStack',
  skills: 'skillGroups',
  experience: 'experiences',
  projects: 'projects',
  socials: 'socials',
  navigation: 'nav',
  marquee: 'marquee',
  languages: 'languages',
};
