import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, NotificationService } from '@pc/medicare-core';
import { navFor, panelLabel, primaryActionFor } from './nav';

/**
 * The panel navigation.
 *
 * One component serves both the fixed desktop rail and the mobile drawer — the
 * shell decides which by positioning it; the markup and the active-link logic
 * stay identical, which is why the two can never drift apart.
 */
@Component({
  selector: 'mc-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="side">
      <a class="brand" [routerLink]="auth.homeRoute()" (click)="navigate.emit()">
        <span class="brand__mark" aria-hidden="true">✚</span>
        <span class="brand__text">
          <strong>MediCare360</strong>
          <span class="brand__panel">{{ panelName() }}</span>
        </span>
      </a>

      <a class="side__cta btn btn--primary" [routerLink]="action().path" (click)="navigate.emit()">
        <span aria-hidden="true">{{ action().icon }}</span>
        {{ action().label }}
      </a>

      <nav class="side__nav" [attr.aria-label]="panelName()">
        @for (section of sections(); track section.title) {
          <div class="side__section">
            <h2 class="side__title">{{ section.title }}</h2>

            <ul>
              @for (link of section.links; track link.path) {
                <li>
                  <a
                    [routerLink]="link.path"
                    routerLinkActive="is-active"
                    [routerLinkActiveOptions]="{ exact: exactFor(link.path) }"
                    [title]="link.hint ?? link.label"
                    (click)="navigate.emit()"
                  >
                    <span class="side__icon" aria-hidden="true">{{ link.icon }}</span>
                    <span class="side__label">{{ link.label }}</span>

                    @if (link.badge === 'notifications' && notifications.unread() > 0) {
                      <span class="side__badge num">{{ notifications.unread() }}</span>
                    }
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>

      <div class="side__foot">
        <p class="text-xs muted">
          Demo hospital. Payments, QR check-in and the emergency button are simulated —
          nothing here contacts a real clinic.
        </p>
      </div>
    </div>
  `,
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly panel = input.required<'patient' | 'doctor'>();

  /** Lets the shell close the mobile drawer when a link is followed. */
  readonly navigate = output<void>();

  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);

  protected sections() {
    return navFor(this.panel());
  }

  protected action() {
    return primaryActionFor(this.panel());
  }

  protected panelName(): string {
    return panelLabel(this.panel(), this.auth.role());
  }

  /**
   * `/patient/pharmacy` must not stay highlighted while you are on
   * `/patient/pharmacy/orders`, but `/patient/appointments` should stay lit on
   * an appointment's detail page. The difference is whether another nav entry
   * lives underneath this path.
   */
  protected exactFor(path: string): boolean {
    return this.sections()
      .flatMap((section) => section.links)
      .some((link) => link.path !== path && link.path.startsWith(`${path}/`));
  }
}
