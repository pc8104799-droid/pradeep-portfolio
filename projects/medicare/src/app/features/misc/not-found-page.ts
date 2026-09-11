import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@pc/medicare-core';

/** A wrong URL, with the one link that is actually useful from here. */
@Component({
  selector: 'mc-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="lost">
      <p class="lost__code num">404</p>
      <h1>That page does not exist</h1>
      <p class="muted">
        The link may be out of date, or the record it pointed at may have been removed.
      </p>

      <div class="row row--wrap">
        <a class="btn btn--primary" [routerLink]="auth.homeRoute()">Back to your dashboard</a>
        <a class="btn btn--outline" [routerLink]="'/' + panel() + '/qr'">Look up an ID instead</a>
      </div>
    </section>
  `,
  styles: `
    .lost {
      display: grid;
      gap: 0.6rem;
      justify-items: center;
      text-align: center;
      padding-block: clamp(2.5rem, 10vh, 6rem);
    }

    .lost__code {
      font-family: var(--font-display);
      font-size: clamp(3rem, 12vw, 5rem);
      font-weight: 700;
      line-height: 1;
      color: var(--primary-soft);
    }

    .lost p.muted {
      max-width: 42ch;
    }

    .row {
      margin-top: 0.5rem;
      justify-content: center;
    }
  `,
})
export class NotFoundPage {
  protected readonly auth = inject(AuthService);

  protected panel(): string {
    return this.auth.role() === 'doctor' ? 'doctor' : 'patient';
  }
}
