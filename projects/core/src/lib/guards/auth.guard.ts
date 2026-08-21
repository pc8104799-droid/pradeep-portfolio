import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Keeps the dashboard behind the sign-in screen and remembers where the visitor
 * was heading so they land there after signing in.
 *
 * This is navigation flow, not security — see the note on AuthService.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.signedIn()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};

/** Sends an already signed-in visitor away from the login and sign-up screens. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.signedIn() ? router.createUrlTree(['/dashboard']) : true;
};
