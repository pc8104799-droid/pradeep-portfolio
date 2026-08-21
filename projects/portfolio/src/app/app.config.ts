import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';

import { routes } from './app.routes';
import { ContentService } from '@pc/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Content is fetched before the first render, so every section reads it
    // synchronously and no section needs a loading state.
    provideAppInitializer(() => inject(ContentService).load()),
    provideRouter(
      routes,
      // Fragment links in the nav need anchor scrolling; the router otherwise
      // jumps to the top on every navigation.
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),
  ],
};
