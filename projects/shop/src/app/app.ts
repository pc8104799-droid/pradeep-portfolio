import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@pc/core';
import { BottomNav } from './layout/bottom-nav';
import { ShopFooter } from './layout/shop-footer';
import { ShopHeader } from './layout/shop-header';
import { ToastHost } from './shared/toast-host';

@Component({
  selector: 'shop-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ShopHeader, ShopFooter, BottomNav, ToastHost],
  template: `
    <shop-header />

    <main id="main">
      <router-outlet />
    </main>

    <shop-footer />
    <shop-bottom-nav />
    <shop-toast-host />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }

    main {
      flex: 1;
      /* Clear the phone tab bar. */
      padding-bottom: 4.5rem;
    }

    @media (min-width: 860px) {
      main {
        padding-bottom: 0;
      }
    }
  `,
})
export class App {
  // Instantiated so the stored theme is applied before the first paint.
  private readonly theme = inject(ThemeService);
}
