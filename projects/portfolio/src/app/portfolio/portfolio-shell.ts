import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Aurora, BackToTop, Cursor, ScrollProgress, SideRails } from '@pc/ui';
import { Footer } from './layout/footer/footer';
import { Navbar } from './layout/navbar/navbar';
import { Home } from './home';

/**
 * The public portfolio: all its chrome — sticky nav, aurora backdrop, custom
 * cursor, side rails, progress rail, footer — lives here rather than in the app
 * root, so the workspace and the auth screens are unaffected by it.
 */
@Component({
  selector: 'app-portfolio-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Navbar, Footer, Home, Aurora, Cursor, ScrollProgress, SideRails, BackToTop],
  template: `
    <app-aurora />
    <app-cursor />
    <app-scroll-progress />
    <app-navbar />
    <app-side-rails />

    <main id="main" class="main">
      <app-home />
    </main>

    <app-footer />
    <app-back-to-top />
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      isolation: isolate;
    }

    /* Everything except the fixed aurora backdrop sits above it. */
    .main,
    app-navbar,
    app-footer {
      position: relative;
      z-index: 1;
    }
  `,
})
export class PortfolioShell {}
