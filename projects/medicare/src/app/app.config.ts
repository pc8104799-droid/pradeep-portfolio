import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import {
  API_BASE_URL,
  AuthService,
  authInterceptor,
  errorInterceptor,
  ThemeService,
} from '@pc/medicare-core';
import { routes } from './app.routes';

/** Where the bundled backend runs unless told otherwise. */
const DEFAULT_API_URL = 'http://127.0.0.1:3000/api';

/** The key a developer can set to point this build at a different host. */
const API_OVERRIDE_KEY = 'medicare360-api';

/**
 * Resolves the API host.
 *
 * The default is the local server this project ships with. Port 3000 is a
 * popular one, though, so it can be overridden per browser without editing or
 * rebuilding anything:
 *
 * ```js
 * localStorage.setItem('medicare360-api', 'http://127.0.0.1:3100/api')
 * ```
 *
 * The value is validated as a URL before it is trusted — a typo should fall
 * back to the default rather than break every request in the app.
 */
export function resolveApiBaseUrl(): string {
  try {
    const override = localStorage.getItem(API_OVERRIDE_KEY);
    if (!override) return DEFAULT_API_URL;

    return new URL(override).href.replace(/\/$/, '');
  } catch {
    return DEFAULT_API_URL;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    { provide: API_BASE_URL, useFactory: resolveApiBaseUrl },

    // Order matters: the auth interceptor adds the token on the way out, and
    // the error interceptor normalises the failure on the way back.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),

    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // Route params arrive as component `input()`s, so a detail page declares
      // what it needs instead of reaching into ActivatedRoute.
      withComponentInputBinding(),
      // Re-runs guards and resolvers when only the params change, so moving
      // between two patients or two prescriptions reloads the data.
      withRouterConfig({ paramsInheritanceStrategy: 'always', onSameUrlNavigation: 'reload' }),
    ),

    /*
     * Restore the session before the first render.
     *
     * Without this, a refresh on a guarded page would briefly have no account
     * and bounce the user to the login screen before the token was checked.
     */
    provideAppInitializer(() => {
      inject(ThemeService); // Applies the stored theme before the first paint.
      return inject(AuthService).restore();
    }),
  ],
};
