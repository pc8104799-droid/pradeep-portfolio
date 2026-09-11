import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  ClinicalService,
  ToastService,
  trackedState,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

/**
 * A lab report.
 *
 * The result and its reference range sit side by side, because a number without
 * its range tells a patient nothing. A doctor viewing the same page gets one
 * extra control: a note that is written back to the report and pushed to the
 * patient as a notification.
 */
@Component({
  selector: 'mc-report-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, QrCode, ...MC_ATOMS, ...MC_PIPES],
  template: `
    <section class="page">
      <mc-data-state
        [busy]="report.loading()"
        [error]="report.error()"
        [skeletonLines]="3"
        [skeletonHeight]="6"
        errorTitle="That report could not be loaded"
        (retry)="report.load()"
      >
        @if (report.data(); as result) {
          <header class="page__head no-print">
            <div>
              <h1>{{ result.testName }}</h1>
              <p>
                {{ result.lab }} · reported {{ result.reportedOn | day }}
                <span class="mono text-xs"> · {{ result.id }}</span>
              </p>
            </div>

            <div class="row row--wrap">
              <a class="btn btn--outline" [routerLink]="'/' + panel() + '/reports'">← All reports</a>
              <button type="button" class="btn btn--outline" (click)="print()">Print</button>
            </div>
          </header>

          <div class="split">
            <div class="stack">
              <article class="card result" [class.is-attention]="result.status === 'attention'">
                <header class="result__head">
                  <div>
                    <span class="result__label">Result</span>
                    <p class="result__value">{{ result.result }}</p>
                  </div>
                  <mc-status [status]="result.status" />
                </header>

                <div class="result__ranges">
                  <div>
                    <span class="result__label">Reference range</span>
                    <strong>{{ result.referenceRange }}</strong>
                  </div>
                  <div>
                    <span class="result__label">Test type</span>
                    <strong>{{ result.category | label }}</strong>
                  </div>
                  <div>
                    <span class="result__label">Sample collected</span>
                    <strong>{{ result.collectedOn | day: 'short' }}</strong>
                  </div>
                </div>
              </article>

              @if (result.labComments) {
                <article class="card card--pad stack--sm">
                  <h2>Laboratory notes</h2>
                  <p>{{ result.labComments }}</p>
                </article>
              }

              <article class="card card--pad stack--sm">
                <h2>Doctor's interpretation</h2>

                @if (result.doctorComments) {
                  <p class="doctor-note">{{ result.doctorComments }}</p>
                  <span class="muted text-xs">— {{ result.doctorName }}</span>
                } @else {
                  <p class="muted text-sm">
                    Your doctor has not commented on this report yet.
                  </p>
                }

                @if (canComment()) {
                  <div class="comment no-print">
                    <label class="field">
                      <span class="field__label">
                        {{ result.doctorComments ? 'Revise your note' : 'Add a note for the patient' }}
                      </span>
                      <textarea
                        rows="3"
                        [ngModel]="comment()"
                        (ngModelChange)="comment.set($event)"
                        placeholder="Values are within range. Continue the current dose and repeat in three months."
                      ></textarea>
                    </label>

                    @if (action.error(); as error) {
                      <p class="field__error" role="alert">{{ error.message }}</p>
                    }

                    <button
                      type="button"
                      class="btn btn--primary btn--sm"
                      [disabled]="action.busy() || comment().trim().length < 3"
                      (click)="saveComment()"
                    >
                      @if (action.busy()) {
                        <span class="btn__spinner" aria-hidden="true"></span>
                      }
                      Save and notify the patient
                    </button>
                  </div>
                }
              </article>
            </div>

            <aside class="stack">
              <article class="card card--pad stack--sm">
                <h2>Report details</h2>

                <div class="kv">
                  <div class="kv__row">
                    <span class="kv__key">Patient</span>
                    <span class="kv__value">
                      {{ result.patientName }}
                      <span class="mono text-xs muted">{{ result.patientId }}</span>
                    </span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Ordered by</span>
                    <span class="kv__value">{{ result.doctorName }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Laboratory</span>
                    <span class="kv__value">{{ result.lab }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Reported</span>
                    <span class="kv__value">{{ result.reportedOn | day }}</span>
                  </div>
                  @if (result.testRequest; as request) {
                    <div class="kv__row">
                      <span class="kv__key">Reason</span>
                      <span class="kv__value">{{ request.clinicalReason }}</span>
                    </div>
                  }
                  <div class="kv__row">
                    <span class="kv__key">Visit</span>
                    <span class="kv__value">
                      <a class="mono" [routerLink]="['/' + panel() + '/appointments', result.appointmentId]">
                        {{ result.appointmentId }}
                      </a>
                    </span>
                  </div>
                </div>
              </article>

              <article class="card card--pad qr-card">
                <h2>Report QR</h2>
                <mc-qr-code [value]="result.id" [caption]="result.testName" [size]="320" />
              </article>
            </aside>
          </div>
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    .result {
      overflow: hidden;
      border-left: 3px solid var(--success);
    }

    .result.is-attention {
      border-left-color: var(--warning);
    }

    .result__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--gap);
      padding: var(--pad-card);
      border-bottom: 1px solid var(--stroke);
      flex-wrap: wrap;
    }

    .result__label {
      display: block;
      color: var(--ink-3);
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: 0.2rem;
    }

    .result__value {
      font-family: var(--font-display);
      font-size: clamp(1.05rem, 2.4vw, 1.35rem);
      font-weight: 600;
      line-height: 1.35;
    }

    .result__ranges {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
    }

    .result__ranges > div {
      padding: var(--pad-card);
      border-right: 1px solid var(--stroke);
    }

    .result__ranges > div:last-child {
      border-right: 0;
    }

    .result__ranges strong {
      font-size: 0.92rem;
    }

    .doctor-note {
      padding: 0.7rem 0.85rem;
      border-radius: var(--radius-sm);
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 0.92rem;
    }

    .comment {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
      padding-top: 0.6rem;
      border-top: 1px solid var(--stroke);
    }

    .comment .field {
      width: 100%;
    }

    .qr-card {
      display: grid;
      gap: 0.5rem;
      justify-items: center;
      text-align: center;
    }

    .qr-card h2,
    aside h2 {
      font-size: 0.95rem;
    }

    .kv__value a {
      color: var(--primary);
      font-weight: 600;
    }

    @media (min-width: 1080px) {
      aside {
        position: sticky;
        top: calc(var(--header-h) + 1rem);
      }
    }
  `,
})
export class ReportDetailPage {
  readonly reportId = input.required<string>();

  private readonly clinical = inject(ClinicalService);
  private readonly toasts = inject(ToastService);

  protected readonly auth = inject(AuthService);
  protected readonly action = new ActionState();
  protected readonly comment = signal('');

  protected readonly panel = computed(() => (this.auth.role() === 'doctor' ? 'doctor' : 'patient'));

  protected readonly report = trackedState(
    () => this.reportId(),
    async () => {
      const report = await this.clinical.report(this.reportId());
      this.comment.set(report.doctorComments ?? '');
      return report;
    },
  );

  /** Only the doctor who ordered the test may annotate it. */
  protected readonly canComment = computed(
    () => this.auth.role() === 'doctor' && this.report.data()?.doctorId === this.auth.profileId(),
  );

  protected print(): void {
    window.print();
  }

  protected async saveComment(): Promise<void> {
    const updated = await this.action.run(() =>
      this.clinical.commentOnReport(this.reportId(), this.comment().trim()),
    );

    if (!updated) return;

    this.report.set(updated);
    this.toasts.success('Note saved', 'The patient has been notified.');
  }
}
