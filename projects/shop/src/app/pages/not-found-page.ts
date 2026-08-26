import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'shop-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="shell card card--pad missing">
        <p class="missing__glyph" aria-hidden="true">🍽️</p>
        <h1>Nothing on this shelf</h1>
        <p class="muted">
          That page does not exist. It may have been renamed, or the link is wrong.
        </p>
        <div class="missing__actions">
          <a class="btn btn--primary" routerLink="/">Back to the store</a>
          <a class="btn btn--outline" routerLink="/menu">Browse everything</a>
        </div>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .missing {
      display: grid;
      justify-items: center;
      gap: .5rem;
      max-width: 520px;
      margin-inline: auto;
      text-align: center;
      padding-block: clamp(2.5rem, 8vw, 5rem);
    }

    .missing__glyph {
      font-size: 3rem;
    }

    .missing__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: .6rem;
      margin-top: .8rem;
    }
  `,
})
export class NotFoundPage {}
