import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  PharmacyService,
  ToastService,
  type Prescription,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { QrScanner } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

interface Verification {
  readonly valid: boolean;
  readonly reason: string | null;
  readonly ageDays: number;
  readonly prescription: Prescription;
}

/**
 * The counter's prescription check.
 *
 * Scan the QR on the slip, or type the ID from it, and the server answers the
 * only question that matters: may this be dispensed? A prescription older than
 * ninety days comes back invalid with the reason, rather than as a silent no.
 *
 * Nothing about validity is decided here — this screen shows what the API
 * ruled, so a pharmacist cannot talk the browser into a yes.
 */
@Component({
  selector: 'mc-verify-prescription',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, QrScanner, ...MC_ATOMS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Verify a prescription</h1>
          <p>Scan the code on the slip, or type the ℞ number under it.</p>
        </div>

        <a class="btn btn--outline" routerLink="/pharmacy/orders">← Dispensing queue</a>
      </header>

      <div class="split split--even">
        <article class="card card--pad stack">
          <h2>Check a slip</h2>

          <mc-qr-scanner (scanned)="verify($event)" />

          @if (action.busy()) {
            <p class="text-sm muted" role="status">Checking…</p>
          }

          @if (action.error(); as error) {
            <div class="note note--danger" role="alert">
              <strong>{{ error.message }}</strong>
              @if (error.isNotFound) {
                <p class="text-xs">
                  Check the ID against the slip — prescriptions look like RX-000012.
                </p>
              }
            </div>
          }
        </article>

        <article class="card card--pad stack--sm">
          @if (result(); as check) {
            <div class="verdict" [class.is-valid]="check.valid">
              <span class="verdict__mark" aria-hidden="true">{{ check.valid ? '✓' : '✕' }}</span>
              <div>
                <h2>{{ check.valid ? 'Valid — safe to dispense' : 'Do not dispense' }}</h2>
                <p class="text-sm">
                  {{
                    check.reason ??
                      (check.valid
                        ? 'Issued ' + check.ageDays + ' days ago, within the 90-day window.'
                        : 'This prescription cannot be used.')
                  }}
                </p>
              </div>
            </div>

            <div class="kv">
              <div class="kv__row">
                <span class="kv__key">Prescription</span>
                <span class="kv__value mono">{{ check.prescription.id }}</span>
              </div>
              <div class="kv__row">
                <span class="kv__key">Patient</span>
                <span class="kv__value">
                  {{ check.prescription.patientName }}
                  <span class="muted text-xs mono">{{ check.prescription.patientId }}</span>
                </span>
              </div>
              <div class="kv__row">
                <span class="kv__key">Prescribed by</span>
                <span class="kv__value">
                  {{ check.prescription.doctorName }}
                  <span class="muted text-xs">{{ check.prescription.departmentName }}</span>
                </span>
              </div>
              <div class="kv__row">
                <span class="kv__key">Diagnosis</span>
                <span class="kv__value">{{ check.prescription.diagnosis }}</span>
              </div>
              <div class="kv__row">
                <span class="kv__key">Issued</span>
                <span class="kv__value">{{ check.prescription.issuedAt | day }}</span>
              </div>
            </div>

            <h3>Medicines on this slip</h3>

            <div class="table-wrap">
              <table class="data">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dose</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  @for (medicine of check.prescription.medicines; track $index) {
                    <tr>
                      <td>
                        <strong>{{ medicine.name }}</strong>
                        <div class="muted text-xs">{{ medicine.strength }} · {{ medicine.timing }}</div>
                      </td>
                      <td>{{ medicine.dosage }}</td>
                      <td>{{ medicine.frequency }}</td>
                      <td>{{ medicine.duration }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="row row--wrap">
              <a
                class="btn btn--outline"
                [routerLink]="['/pharmacy/prescriptions', check.prescription.id]"
              >
                Open the full slip
              </a>
              <button type="button" class="btn btn--ghost" (click)="clear()">Check another</button>
            </div>
          } @else {
            <div class="idle">
              <span class="idle__mark" aria-hidden="true">℞</span>
              <h2>Nothing checked yet</h2>
              <p class="muted text-sm">
                A verified slip shows the patient, the prescriber and every medicine on it — so
                what goes in the bag can be matched line by line.
              </p>
            </div>
          }
        </article>
      </div>
    </section>
  `,
  styles: `
    h2 {
      font-size: 1rem;
    }

    h3 {
      font-size: 0.85rem;
      color: var(--ink-2);
    }

    .note {
      display: block;
      padding: 0.65rem 0.8rem;
      border-radius: var(--radius-sm);
      font-size: 0.86rem;
    }

    .note--danger {
      background: var(--danger-soft);
      color: var(--danger);
    }

    /* The verdict is the whole point of the screen, so it reads first and
       loudest — green or red, with the reason underneath. */
    .verdict {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: var(--radius);
      background: var(--danger-soft);
      color: var(--danger);
      animation: pop var(--t) var(--ease) both;
    }

    .verdict.is-valid {
      background: var(--success-soft);
      color: var(--success);
    }

    .verdict__mark {
      display: grid;
      place-items: center;
      width: 2.4rem;
      height: 2.4rem;
      border-radius: var(--radius-pill);
      background: currentcolor;
      color: var(--surface);
      font-size: 1.3rem;
      font-weight: 700;
      flex: none;
    }

    .verdict h2 {
      font-size: 1rem;
    }

    .idle {
      display: grid;
      gap: 0.5rem;
      justify-items: center;
      text-align: center;
      padding-block: clamp(1.5rem, 6vw, 3rem);
    }

    .idle__mark {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: var(--radius-pill);
      background: var(--surface-3);
      color: var(--ink-3);
      font-size: 1.5rem;
    }

    .idle p {
      max-width: 40ch;
    }
  `,
})
export class VerifyPrescriptionPage {
  private readonly pharmacy = inject(PharmacyService);
  private readonly toasts = inject(ToastService);

  protected readonly action = new ActionState();
  protected readonly result = signal<Verification | null>(null);

  protected async verify(code: string): Promise<void> {
    this.result.set(null);

    // A scanned deep link carries the id; a typed one is the id already.
    const id = code.trim().toUpperCase().replace(/^.*[/:]/, '');

    const check = await this.action.run(() => this.pharmacy.verifyPrescription(id));
    if (!check) return;

    this.result.set(check);

    if (check.valid) {
      this.toasts.success('Prescription valid', `${check.prescription.patientName} · ${id}`);
    } else {
      this.toasts.warning('Do not dispense', check.reason ?? 'This prescription is not valid.');
    }
  }

  protected clear(): void {
    this.result.set(null);
    this.action.clear();
  }
}
