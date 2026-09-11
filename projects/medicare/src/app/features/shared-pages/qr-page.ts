import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  QrService,
  ToastService,
  type QrResult,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { QrCode, QrScanner } from '../../shared/ui/qr';

/**
 * Scan or show a MediCare360 code.
 *
 * Two halves: the code this account carries (a patient shows theirs at
 * reception; a doctor shows theirs on a consultation slip), and a scanner for
 * anyone else's. What a scan resolves to is decided entirely by the server —
 * a patient scanning another patient's card gets a 403, not a record.
 */
@Component({
  selector: 'mc-qr-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, QrCode, QrScanner, ...MC_ATOMS],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Scan a code</h1>
          <p>
            Every patient, appointment, prescription, report and order has a QR. Scanning one opens
            exactly what your account is allowed to see.
          </p>
        </div>
      </header>

      <div class="split split--even">
        <article class="card card--pad stack">
          <h2>Scanner</h2>

          <mc-qr-scanner (scanned)="resolve($event)" />

          @if (action.busy()) {
            <p class="text-sm muted" role="status">Looking that up…</p>
          }

          @if (action.error(); as error) {
            <div class="note note--danger" role="alert">
              <strong>{{ error.message }}</strong>
              @if (error.details['code']) {
                <p class="text-xs">{{ error.details['code'] }}</p>
              }
            </div>
          }

          @if (result(); as found) {
            <div class="found card card--pad">
              <div class="spread">
                <span class="badge badge--primary">{{ found.kind }}</span>
                <span class="mono text-xs">{{ found.code }}</span>
              </div>

              <h3>{{ found.summary.title }}</h3>

              <ul class="found__lines">
                @for (line of found.summary.lines; track line) {
                  @if (line) {
                    <li>{{ line }}</li>
                  }
                }
              </ul>

              <a class="btn btn--primary btn--sm" [routerLink]="found.summary.link">Open the record</a>
            </div>
          }

          <div class="hints">
            <span class="text-xs muted">Codes look like</span>
            <div class="row row--wrap">
              @for (hint of hints; track hint) {
                <button type="button" class="chip" (click)="resolve(hint)">{{ hint }}</button>
              }
            </div>
            <p class="text-xs muted">
              These examples are from your own records — a code belonging to someone else is refused
              by the server, not hidden by this screen.
            </p>
          </div>
        </article>

        <article class="card card--pad stack">
          <h2>Your code</h2>
          <p class="text-sm muted">
            {{
              auth.role() === 'doctor'
                ? 'Reception and the pharmacy scan this to confirm who issued a prescription.'
                : 'Show this at reception to check in without giving your details again.'
            }}
          </p>

          <mc-qr-code [value]="auth.profileId() ?? ''" [caption]="auth.user()?.name ?? ''" [size]="460" />

          <div class="kv">
            <div class="kv__row">
              <span class="kv__key">ID</span>
              <span class="kv__value mono">{{ auth.profileId() }}</span>
            </div>
            <div class="kv__row">
              <span class="kv__key">Account</span>
              <span class="kv__value">{{ auth.user()?.name }}</span>
            </div>
            <div class="kv__row">
              <span class="kv__key">Role</span>
              <span class="kv__value">{{ auth.role() }}</span>
            </div>
          </div>

          <mc-note tone="info">
            The code contains only this ID. Nothing about your health is encoded in it, so a
            photographed code is useless without a signed-in account.
          </mc-note>

          <button type="button" class="btn btn--outline" (click)="print()">Print the card</button>
        </article>
      </div>
    </section>
  `,
  styles: `
    h2 {
      font-size: 1rem;
    }

    .note {
      display: block;
      padding: 0.65rem 0.8rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
    }

    .note--danger {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .found {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
      border-left: 3px solid var(--success);
      background: var(--success-soft);
      animation: pop var(--t) var(--ease) both;
    }

    .found h3 {
      font-size: 1.05rem;
    }

    .found__lines {
      display: grid;
      gap: 0.15rem;
      font-size: 0.87rem;
      color: var(--ink-2);
    }

    .hints {
      display: grid;
      gap: 0.35rem;
      padding-top: 0.6rem;
      border-top: 1px solid var(--stroke);
    }
  `,
})
export class QrPage {
  protected readonly auth = inject(AuthService);

  private readonly qr = inject(QrService);
  private readonly toasts = inject(ToastService);

  protected readonly action = new ActionState();
  protected readonly result = signal<QrResult | null>(null);

  /** One-tap examples, always including the caller's own id. */
  protected readonly hints = computed(() => [this.auth.profileId() ?? ''].filter(Boolean))();

  protected async resolve(code: string): Promise<void> {
    this.result.set(null);

    const found = await this.action.run(() => this.qr.resolve(code));
    if (!found) return;

    this.result.set(found);
    this.toasts.success(`Found ${found.kind}`, found.summary.title);
  }

  protected print(): void {
    window.print();
  }
}
