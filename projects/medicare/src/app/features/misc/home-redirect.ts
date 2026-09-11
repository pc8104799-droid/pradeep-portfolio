import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@pc/medicare-core';

/**
 * The landing route.
 *
 * `/` cannot be a static redirect, because where it should go depends on who is
 * signed in — a doctor belongs in the clinic, a patient on their dashboard, a
 * visitor on the sign-in screen. A component makes that one decision and never
 * renders.
 */
@Component({
  selector: 'mc-home-redirect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="sr-only">Taking you to your dashboard…</p>`,
})
export class HomeRedirect {
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);

    void router.navigateByUrl(auth.signedIn() ? auth.homeRoute() : '/login', {
      // A redirect should not leave an entry the back button can bounce off.
      replaceUrl: true,
    });
  }
}
