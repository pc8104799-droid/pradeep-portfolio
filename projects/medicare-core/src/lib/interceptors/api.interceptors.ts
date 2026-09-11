import { inject } from '@angular/core';
import { type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';
import { TokenStore } from '../services/token.store';

/**
 * Attaches the bearer token to calls that are going to our own API.
 *
 * The host check matters: without it, adding any third-party request later
 * would quietly start leaking the session token to someone else's server.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(TokenStore);
  const token = tokens.token();

  if (!token || !tokens.isOwnApi(request.url)) return next(request);

  return next(
    request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};

/**
 * Turns every failure into an `ApiError` and drops the session on a 401.
 *
 * Clearing the token here rather than in each service is what stops an expired
 * session from producing a screen full of failed panels: the next guarded
 * navigation sees no token and redirects to sign-in.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(TokenStore);

  return next(request).pipe(
    catchError((response) => {
      const error = ApiError.from(response);

      // The login call answers 401 for a wrong password; that is not an expired
      // session and must not clear a token the user may still be holding.
      if (error.isAuthFailure && !request.url.includes('/auth/login')) {
        tokens.clear();
      }

      return throwError(() => error);
    }),
  );
};
