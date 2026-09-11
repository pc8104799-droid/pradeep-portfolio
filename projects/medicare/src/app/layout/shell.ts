import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthService, CatalogService, NotificationService, type Panel } from '@pc/medicare-core';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * The chrome both panels share: a fixed sidebar on desktop, a drawer on a
 * phone, a header, and the routed page.
 *
 * The shell is also where per-session work happens once rather than per page —
 * loading the reference lists and the unread count — so a screen can assume
 * departments are already there.
 */
@Component({
  selector: 'mc-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Sidebar, Topbar],
  template: `
    <div class="shell-grid" [class.is-nav-open]="navOpen()">
      <mc-sidebar class="shell-side" [panel]="panel()" (navigate)="navOpen.set(false)" />

      <!-- Only rendered while the drawer is open, so it cannot swallow taps
           on desktop where the sidebar is permanent. -->
      @if (navOpen()) {
        <button type="button" class="shell-scrim" (click)="navOpen.set(false)" aria-label="Close navigation"></button>
      }

      <div class="shell-main">
        <mc-topbar
          [panel]="panel()"
          [title]="heading()"
          [subtitle]="greeting()"
          [navOpen]="navOpen()"
          (toggleNav)="navOpen.set(!navOpen())"
        />

        <main id="main" class="shell-content">
          <div class="shell">
            <router-outlet />
          </div>
        </main>
      </div>
    </div>
  `,
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly catalog = inject(CatalogService);
  private readonly notifications = inject(NotificationService);

  protected readonly navOpen = signal(false);

  /** Which panel this shell instance is rendering, from the route data. */
  protected readonly panel = computed<Panel>(
    () => (this.route.snapshot.data['panel'] as Panel) ?? this.auth.panel(),
  );

  /**
   * The header title, taken from the active route's `title`.
   *
   * Reading it from the router rather than having each page set it keeps the
   * page title, the browser tab and the header from ever disagreeing.
   */
  protected readonly heading = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.deepestTitle()),
    ),
    { initialValue: '' },
  );

  /** The line under the page title: who is signed in, and where. */
  protected readonly greeting = computed(() => {
    const user = this.auth.user();
    if (!user) return '';

    switch (this.panel()) {
      case 'doctor':
        return `${user.name} · ${this.auth.doctor()?.departmentName ?? 'Consultant'}`;
      case 'admin':
      case 'pharmacy':
        return `${user.name} · ${this.auth.branch()?.city ?? 'MediCare360'}`;
      default:
        return `${user.name} · ${user.profileId}`;
    }
  });

  constructor() {
    // Close the drawer whenever the URL changes, including a back-button
    // navigation that no link click would have caught.
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.navOpen.set(false);
    });

    effect(() => {
      if (!this.auth.signedIn()) return;

      void this.catalog.loadReference().catch(() => {
        // A failed reference load degrades a filter list, not the whole app;
        // the screens that need it surface their own error.
      });
      void this.notifications.refreshUnread();
    });
  }

  /** The `title` of the most specific matched route. */
  private deepestTitle(): string {
    let route = this.route.snapshot;
    while (route.firstChild) route = route.firstChild;

    // Route titles carry the app name for the browser tab; the header does not
    // need to repeat it.
    return String(route.title ?? '').replace(/\s*—\s*MediCare360$/, '');
  }
}
