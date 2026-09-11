import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import type { Role } from '../models/medicare.models';

/**
 * Route guards.
 *
 * These are navigation, not security. The API decides what an account may
 * actually read or write — see the role middleware on the server. What these do
 * is keep a patient from landing on a doctor screen that would only fill with
 * 403s, and send people back where they were trying to go after signing in.
 */

/** Requires a signed-in account, remembering the destination. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // On a hard refresh the token is still being exchanged for an account, so
  // wait for that rather than bouncing a signed-in user to the login screen.
  if (auth.restoring()) await auth.restore();

  if (auth.signedIn()) return true;

  return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};

/** Requires one of the given roles; anyone else goes to their own home screen. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.restoring()) await auth.restore();

    if (!auth.signedIn()) {
      return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
    }

    if (auth.has(...roles)) return true;

    // Not an error page: send them somewhere they can actually use, and say why.
    return router.createUrlTree([auth.homeRoute()], {
      queryParams: { denied: state.url },
    });
  };
}

/** Sends an already signed-in visitor away from login and registration. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.restoring()) await auth.restore();

  return auth.signedIn() ? router.createUrlTree([auth.homeRoute()]) : true;
};
