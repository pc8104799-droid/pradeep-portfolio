import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@pc/core';
import { CartService } from '@pc/shop-core';

/** Phone-only tab bar. Hidden from 860px up, where the header carries these. */
@Component({
  selector: 'shop-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav aria-label="Main">
      <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">
        <span aria-hidden="true">🏠</span>
        Home
      </a>
      <a routerLink="/menu" routerLinkActive="is-active">
        <span aria-hidden="true">🧺</span>
        Browse
      </a>
      <a class="cart" routerLink="/cart" routerLinkActive="is-active">
        <span aria-hidden="true">🛒</span>
        Cart
        @if (cart.count() > 0) {
          <em class="mono-num">{{ cart.count() }}</em>
        }
      </a>
      <a [routerLink]="auth.signedIn() ? '/orders' : '/login'" routerLinkActive="is-active">
        <span aria-hidden="true">📦</span>
        {{ auth.signedIn() ? 'Orders' : 'Sign in' }}
      </a>
    </nav>
  `,
  styles: `
    :host {
      position: fixed;
      inset: auto 0 0;
      z-index: 90;
      display: block;
      border-top: 1px solid var(--stroke);
      background: color-mix(in srgb, var(--bg-2) 96%, transparent);
      backdrop-filter: blur(12px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    nav {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
    }

    a {
      position: relative;
      display: grid;
      justify-items: center;
      gap: .1rem;
      padding: .55rem .3rem .6rem;
      color: var(--ink-3);
      font-size: .68rem;
      font-weight: 600;
    }

    a span {
      font-size: 1.15rem;
      line-height: 1;
    }

    a.is-active {
      color: var(--leaf-700);
    }

    a.is-active::before {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      width: 28px;
      height: 2px;
      border-radius: 99px;
      background: var(--leaf-700);
      transform: translateX(-50%);
    }

    .cart em {
      position: absolute;
      top: .3rem;
      right: calc(50% - 22px);
      display: grid;
      place-items: center;
      min-width: 17px;
      height: 17px;
      padding-inline: 3px;
      border-radius: 99px;
      background: var(--carrot-500);
      color: #fff;
      font-size: .62rem;
      font-style: normal;
      font-weight: 700;
    }

    @media (min-width: 860px) {
      :host {
        display: none;
      }
    }
  `,
})
export class BottomNav {
  protected readonly cart = inject(CartService);
  protected readonly auth = inject(AuthService);
}
