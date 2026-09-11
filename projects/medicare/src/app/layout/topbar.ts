import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AuthService,
  NotificationService,
  PharmacyService,
  ThemeService,
  ToastService,
  type Panel,
  type ThemeId,
} from '@pc/medicare-core';
import { Person } from '../shared/ui/atoms';

/**
 * The application header.
 *
 * It carries the things that must be reachable from every screen: the menu
 * button on a phone, the theme switch, the notification bell, the basket, and
 * the account menu. Everything else belongs to the page.
 */
@Component({
  selector: 'mc-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Person],
  template: `
    <header class="top">
      <button
        type="button"
        class="btn btn--ghost btn--icon top__menu"
        (click)="toggleNav.emit()"
        [attr.aria-expanded]="navOpen()"
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      <div class="top__title">
        <strong>{{ title() }}</strong>
        @if (subtitle()) {
          <span class="muted text-xs truncate">{{ subtitle() }}</span>
        }
      </div>

      <div class="top__actions">
        @if (panel() === 'patient') {
          <a
            class="btn btn--ghost btn--icon top__cart"
            routerLink="/patient/pharmacy/cart"
            [attr.aria-label]="'Basket, ' + pharmacy.count() + ' items'"
          >
            ⊞
            @if (pharmacy.count() > 0) {
              <span class="top__count num">{{ pharmacy.count() }}</span>
            }
          </a>
        }

        <a
          class="btn btn--ghost btn--icon top__bell"
          [routerLink]="'/' + panel() + '/notifications'"
          [attr.aria-label]="'Notifications, ' + notifications.unread() + ' unread'"
        >
          ◉
          @if (notifications.unread() > 0) {
            <span class="top__count num">{{ notifications.unread() }}</span>
          }
        </a>

        <!-- A one-click light/dark flip for the common case; the full palette
             lives on the appearance screen. -->
        <button
          type="button"
          class="btn btn--ghost btn--icon"
          (click)="theme.toggle()"
          [attr.aria-label]="theme.isDark() ? 'Switch to the light theme' : 'Switch to the dark theme'"
        >
          {{ theme.isDark() ? '☀' : '☾' }}
        </button>

        <div class="top__account">
          <button
            type="button"
            class="top__trigger"
            (click)="menuOpen.set(!menuOpen())"
            [attr.aria-expanded]="menuOpen()"
          >
            <mc-person [name]="auth.user()?.name ?? 'Account'" [meta]="roleLabel()" size="sm" />
            <span aria-hidden="true" class="top__chevron">▾</span>
          </button>

          @if (menuOpen()) {
            <!-- A transparent sheet behind the menu closes it on any outside
                 click without a global document listener. -->
            <button type="button" class="top__scrim" (click)="menuOpen.set(false)" tabindex="-1" aria-hidden="true"></button>

            <div class="menu card">
              <div class="menu__head">
                <strong>{{ auth.user()?.name }}</strong>
                <span class="muted text-xs">{{ auth.user()?.email }}</span>
                <span class="mono text-xs">{{ auth.profileId() }}</span>
              </div>

              <div class="menu__themes">
                <span class="menu__label">Theme</span>
                <div class="menu__swatches">
                  @for (option of theme.options; track option.id) {
                    <button
                      type="button"
                      class="swatch"
                      [class.is-active]="theme.theme() === option.id"
                      [style.--a]="option.swatch[0]"
                      [style.--b]="option.swatch[1]"
                      [title]="option.name + ' — ' + option.hint"
                      (click)="choose(option.id)"
                    >
                      <span class="sr-only">{{ option.name }}</span>
                    </button>
                  }
                </div>
              </div>

              <div class="menu__links">
                <!-- Reception and pharmacy accounts belong to a desk rather
                     than a person, so there is no profile to edit. -->
                @if (panel() === 'patient' || panel() === 'doctor') {
                  <a [routerLink]="'/' + panel() + '/profile'" (click)="menuOpen.set(false)">Your profile</a>
                }
                <a [routerLink]="'/' + panel() + '/settings'" (click)="menuOpen.set(false)">Appearance & security</a>
                <a [routerLink]="'/' + panel() + '/qr'" (click)="menuOpen.set(false)">Scan a code</a>
              </div>

              <button type="button" class="menu__signout" (click)="signOut()">Sign out</button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styleUrl: './topbar.scss',
})
export class Topbar {
  readonly panel = input.required<Panel>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly navOpen = input(false);

  readonly toggleNav = output<void>();

  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationService);
  protected readonly pharmacy = inject(PharmacyService);

  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly menuOpen = signal(false);

  protected roleLabel(): string {
    const role = this.auth.role();
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
  }

  protected choose(theme: ThemeId): void {
    this.theme.set(theme);
  }

  protected async signOut(): Promise<void> {
    this.menuOpen.set(false);
    this.auth.logout();
    this.notifications.reset();
    this.pharmacy.clear();

    await this.router.navigateByUrl('/login');
    this.toasts.info('Signed out', 'Your session on this device has ended.');
  }
}
