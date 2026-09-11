import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AuthService, lazyState, PatientService, ToastService } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { ConfirmService } from '../../shared/ui/dialogs';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

/**
 * The emergency card.
 *
 * Designed to be readable by a stranger in thirty seconds: blood group, what
 * this person reacts to, what they already take, and who to ring. It prints to
 * a wallet card, and carries the patient QR so a paramedic with a scanner
 * reaches the same record.
 *
 * The emergency button is a demonstration. It does not contact anyone, and the
 * page says so plainly rather than implying a dispatch that does not exist.
 */
@Component({
  selector: 'mc-emergency-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataState, QrCode, ...MC_ATOMS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head no-print">
        <div>
          <h1>Emergency card</h1>
          <p>What a paramedic or a stranger needs to know if you cannot tell them yourself.</p>
        </div>

        <div class="row row--wrap">
          <button type="button" class="btn btn--outline" (click)="print()">Print wallet card</button>
          <button type="button" class="btn btn--danger" (click)="raise()">Emergency help</button>
        </div>
      </header>

      <mc-note tone="warning" class="no-print">
        This is a portfolio demonstration. The emergency button does not call an ambulance or notify
        anyone — in a real emergency, dial 112.
      </mc-note>

      <mc-data-state
        [busy]="card.loading()"
        [error]="card.error()"
        [skeletonLines]="2"
        [skeletonHeight]="9"
        errorTitle="Your emergency card did not load"
        (retry)="card.load()"
      >
        @if (card.data(); as info) {
          <article class="card emergency">
            <header class="emergency__head">
              <div>
                <span class="emergency__label">Medical emergency card</span>
                <h2>{{ info.name }}</h2>
                <p class="mono">{{ info.patientId }} · {{ info.age }} years · {{ info.gender | label }}</p>
              </div>

              <div class="emergency__blood">
                <span>Blood</span>
                <strong>{{ info.bloodGroup === 'unknown' ? '?' : info.bloodGroup }}</strong>
              </div>
            </header>

            <div class="emergency__grid">
              <section class="emergency__block emergency__block--alert">
                <h3>Allergies</h3>
                @if (info.allergies.length) {
                  <ul>
                    @for (allergy of info.allergies; track allergy) {
                      <li>{{ allergy }}</li>
                    }
                  </ul>
                } @else {
                  <p class="muted">None recorded</p>
                }
              </section>

              <section class="emergency__block">
                <h3>Existing conditions</h3>
                @if (info.conditions.length) {
                  <ul>
                    @for (condition of info.conditions; track condition) {
                      <li>{{ condition }}</li>
                    }
                  </ul>
                } @else {
                  <p class="muted">None recorded</p>
                }
              </section>

              <section class="emergency__block">
                <h3>Current medicines</h3>
                @if (info.currentMedicines.length) {
                  <ul>
                    @for (medicine of info.currentMedicines; track medicine) {
                      <li>{{ medicine }}</li>
                    }
                  </ul>
                } @else {
                  <p class="muted">None recorded</p>
                }
              </section>

              <section class="emergency__block emergency__block--contact">
                <h3>Call first</h3>
                <strong>{{ info.emergencyContactName }}</strong>
                <p>{{ info.emergencyContactRelationship }}</p>
                <a class="emergency__phone" [href]="'tel:' + info.emergencyContact">
                  {{ info.emergencyContact }}
                </a>
              </section>
            </div>

            <footer class="emergency__foot">
              <div class="emergency__hospital">
                <h3>Registered hospital</h3>
                @if (info.branch; as branch) {
                  <strong>{{ branch.name }}</strong>
                  <p class="text-sm">{{ branch.address }}</p>
                  <p class="text-sm">
                    {{ branch.phone }}
                    @if (branch.emergency) {
                      · 24x7 emergency
                    }
                  </p>
                }

                @if (info.insuranceProvider) {
                  <p class="text-sm">
                    Insurance: <strong>{{ info.insuranceProvider }}</strong>
                    <span class="mono"> {{ info.insuranceNumber }}</span>
                  </p>
                }
              </div>

              <mc-qr-code
                [value]="info.patientId"
                caption="Scan for the full record"
                [size]="320"
              />
            </footer>
          </article>
        }
      </mc-data-state>

      @if (raised()) {
        <article class="card card--pad card--rail card--danger no-print" role="alert">
          <h2>Simulated emergency raised</h2>
          <p class="text-sm">
            In a live deployment this is where the hospital would be paged with your location, your
            emergency card and your registered branch. Nothing was sent.
          </p>
          <button type="button" class="btn btn--outline btn--sm" (click)="raised.set(false)">
            Dismiss
          </button>
        </article>
      }
    </section>
  `,
  styleUrl: './emergency-page.scss',
})
export class EmergencyPage {
  private readonly patients = inject(PatientService);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly raised = signal(false);

  protected readonly card = lazyState(() => this.patients.emergency(this.auth.profileId() ?? ''));

  constructor() {
    void this.card.load();
  }

  protected print(): void {
    window.print();
  }

  protected async raise(): Promise<void> {
    const agreed = await this.confirm.ask({
      heading: 'Raise a simulated emergency?',
      body: 'This is a demonstration only — no ambulance is dispatched and nobody is contacted. In a real emergency, dial 112.',
      confirmLabel: 'Run the simulation',
      tone: 'danger',
    });

    if (!agreed) return;

    this.raised.set(true);
    this.toasts.warning('Simulated only', 'No emergency service was contacted.');
  }
}
