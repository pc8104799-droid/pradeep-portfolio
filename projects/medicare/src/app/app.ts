import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@pc/medicare-core';
import { ConfirmHost } from './shared/ui/dialogs';
import { ToastHost } from './shared/ui/toast-host';

/**
 * The application root.
 *
 * It holds only the things that must outlive every route: the outlet, the toast
 * stack and the confirmation dialog host. The chrome — sidebar, header — belongs
 * to the shell each panel routes through, because the login screen has none of
 * it.
 */
@Component({
  selector: 'mc-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHost, ConfirmHost],
  template: `
    <a class="skip-link" href="#main">Skip to main content</a>

    @if (auth.restoring()) {
      <!-- The stored token is being exchanged for an account. Showing a bare
           splash rather than the app avoids a flash of the signed-out state. -->
      <div class="boot" role="status" aria-live="polite">
        <span class="boot__mark" aria-hidden="true">+</span>
        <p>Restoring your session…</p>
      </div>
    } @else {
      <router-outlet />
    }

    <mc-toast-host />
    <mc-confirm-host />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
    }

    .boot {
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 0.75rem;
      min-height: 100dvh;
      color: var(--ink-3);
    }

    .boot__mark {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: var(--radius);
      background: var(--primary);
      color: var(--primary-ink);
      font-family: var(--font-display);
      font-size: 1.8rem;
      font-weight: 700;
      animation: pulse 1.4s ease-in-out infinite;
    }
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
}
