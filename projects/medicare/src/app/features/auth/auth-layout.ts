import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ThemeService } from '@pc/medicare-core';

/**
 * The frame around sign-in and registration.
 *
 * These two screens are outside the app shell — no sidebar, no account menu —
 * so they share a layout of their own: a brand panel that says what the product
 * is, the form, and a slot for whatever supports it (demo accounts, a progress
 * rail). The theme picker is here too, because a visitor should be able to pick
 * a readable theme before they have an account to store it against.
 */
@Component({
  selector: 'mc-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth">
      <aside class="auth__brand">
        <a class="brand" href="/">
          <span class="brand__mark" aria-hidden="true">✚</span>
          <strong>MediCare360</strong>
        </a>

        <div class="auth__pitch">
          <h1>{{ heading() }}</h1>
          <p>{{ blurb() }}</p>

          <ul class="auth__points">
            @for (point of points; track point) {
              <li>{{ point }}</li>
            }
          </ul>
        </div>

        <div class="auth__themes">
          <span class="text-xs">Theme</span>
          @for (option of theme.options; track option.id) {
            <button
              type="button"
              class="swatch"
              [class.is-active]="theme.theme() === option.id"
              [style.--a]="option.swatch[0]"
              [style.--b]="option.swatch[1]"
              [title]="option.name"
              (click)="theme.set(option.id)"
            >
              <span class="sr-only">{{ option.name }}</span>
            </button>
          }
        </div>
      </aside>

      <main id="main" class="auth__main">
        <div class="auth__form card card--pad">
          <ng-content />
        </div>

        <div class="auth__aside">
          <ng-content select="[slot='aside']" />
        </div>
      </main>
    </div>
  `,
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {
  readonly heading = input.required<string>();
  readonly blurb = input('');

  protected readonly theme = inject(ThemeService);

  protected readonly points = [
    'Book by department, doctor and time slot — with live availability',
    'Prescriptions, lab reports and visit history in one timeline',
    'Order medicines against a verified prescription',
    'QR check-in at reception, and a printable emergency card',
  ];
}
