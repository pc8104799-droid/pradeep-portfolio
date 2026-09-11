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

/**
 * The API host.
 *
 * Hard-coded to the local server because this project ships with its own
 * backend; it is an injection token so a deployed build can be pointed
 * elsewhere by overriding one provider.
 */
const API_URL = 'http://127.0.0.1:3000/api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    { provide: API_BASE_URL, useValue: API_URL },

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
