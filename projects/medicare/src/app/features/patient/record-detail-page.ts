import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClinicalService, trackedState, type Vitals } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * One visit, in full.
 *
 * This is the page that ties the whole workflow together: the consultation the
 * doctor wrote, the vitals they took, the prescription that came out of it and
 * the lab reports that followed — reachable from a single record id, which is
 * also what a scanned MR- code resolves to.
 */
@Component({
  selector: 'mc-record-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_PIPES],
  template: `
    <section class="page">
      <mc-data-state
        [busy]="record.loading()"
        [error]="record.error()"
        [skeletonLines]="3"
        [skeletonHeight]="7"
        errorTitle="That visit could not be loaded"
        (retry)="record.load()"
      >
        @if (record.data(); as visit) {
          <header class="page__head">
            <div>
              <h1>{{ visit.diagnosis }}</h1>
              <p>
                {{ visit.doctorName }} · {{ visit.departmentName }} · {{ visit.visitDate | day }}
                <span class="mono text-xs"> · {{ visit.id }}</span>
              </p>
            </div>

            <div class="row row--wrap no-print">
              <a class="btn btn--outline" routerLink="/patient/records">← History</a>
              <button type="button" class="btn btn--outline" (click)="print()">Print</button>
            </div>
          </header>

          <div class="split">
            <div class="stack">
              @if (visit.consultation; as consultation) {
                <article class="card card--pad stack--sm">
                  <h2>Consultation notes</h2>

                  <div class="kv">
                    <div class="kv__row">
                      <span class="kv__key">Chief complaint</span>
                      <span class="kv__value">{{ consultation.chiefComplaint }}</span>
                    </div>
                    <div class="kv__row">
                      <span class="kv__key">Symptoms</span>
                      <span class="kv__value">{{ consultation.symptoms | listOr: 'Not recorded' }}</span>
                    </div>
                    <div class="kv__row">
                      <span class="kv__key">Examination</span>
                      <span class="kv__value">{{ consultation.examination || 'Not recorded' }}</span>
                    </div>
                    <div class="kv__row">
                      <span class="kv__key">Diagnosis</span>
                      <span class="kv__value">{{ consultation.diagnosis }}</span>
                    </div>
                    <div class="kv__row">
                      <span class="kv__key">Treatment plan</span>
                      <span class="kv__value">{{ consultation.treatmentPlan || 'Not recorded' }}</span>
                    </div>
                    <div class="kv__row">
                      <span class="kv__key">Notes</span>
                      <span class="kv__value">{{ consultation.notes || '—' }}</span>
                    </div>
                  </div>
                </article>

                @if (hasVitals(consultation.vitals)) {
                  <article class="card card--pad stack--sm">
                    <h2>Vitals recorded</h2>

                    <div class="vitals">
                      @for (vital of vitalList(consultation.vitals); track vital.label) {
                        <div class="vital">
                          <span class="text-xs muted">{{ vital.label }}</span>
                          <strong class="num">{{ vital.value }}</strong>
                        </div>
                      }
                    </div>
                  </article>
                }
              }

              @if (visit.prescription; as rx) {
                <article class="card card--flush">
                  <header class="card__head">
                    <h2>Prescription</h2>
                    <a class="btn btn--ghost btn--sm" [routerLink]="['/patient/prescriptions', rx.id]">
                      Open ℞ →
                    </a>
                  </header>

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
                        @for (medicine of rx.medicines; track medicine.name) {
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
                </article>
              }

              @if (visit.reports?.length) {
                <article class="card card--flush">
                  <header class="card__head"><h2>Lab reports from this visit</h2></header>

                  <ul class="reports">
                    @for (report of visit.reports!; track report.id) {
                      <li>
                        <a [routerLink]="['/patient/reports', report.id]">
                          <div>
                            <strong>{{ report.testName }}</strong>
                            <span class="muted text-xs">{{ report.lab }} · {{ report.reportedOn | day: 'short' }}</span>
                          </div>
                          <mc-status [status]="report.status" />
                        </a>
                      </li>
                    }
                  </ul>
                </article>
              }
            </div>

            <aside class="stack">
              <article class="card card--pad stack--sm">
                <h2>Visit summary</h2>

                <div class="kv">
                  <div class="kv__row">
                    <span class="kv__key">Date</span>
                    <span class="kv__value">{{ visit.visitDate | day }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Type</span>
                    <span class="kv__value">{{ visit.visitType | label }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Treatment</span>
                    <span class="kv__value">{{ visit.treatment || '—' }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Branch</span>
                    <span class="kv__value">{{ visit.branch?.name ?? '—' }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Appointment</span>
                    <span class="kv__value">
                      <a class="mono" [routerLink]="['/patient/appointments', visit.appointmentId]">
                        {{ visit.appointmentId }}
                      </a>
                    </span>
                  </div>
                </div>
              </article>

              @if (visit.followUpDate) {
                <article class="card card--pad card--rail">
                  <h2>Follow-up</h2>
                  <p class="text-sm">
                    Your doctor asked to see you again on
                    <strong>{{ visit.followUpDate | day }}</strong>.
                  </p>
                  <a
                    class="btn btn--primary btn--sm no-print"
                    routerLink="/patient/book"
                    [queryParams]="{ doctorId: visit.doctorId, date: visit.followUpDate }"
                  >
                    Book the follow-up
                  </a>
                </article>
              }
            </aside>
          </div>
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    .vitals {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
      gap: 0.5rem;
    }

    .vital {
      display: grid;
      gap: 0.1rem;
      padding: 0.5rem 0.6rem;
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }

    .vital strong {
      font-family: var(--font-display);
      font-size: 1rem;
    }

    .reports li a {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-sm);
      padding: 0.6rem var(--pad-card);
      border-bottom: 1px solid var(--stroke);
    }

    .reports li:last-child a {
      border-bottom: 0;
    }

    .reports li a:hover {
      background: var(--surface-2);
    }

    .reports strong {
      display: block;
      font-size: 0.88rem;
    }

    .card--rail p {
      margin-bottom: 0.6rem;
    }
  `,
})
export class RecordDetailPage {
  readonly recordId = input.required<string>();

  private readonly clinical = inject(ClinicalService);

  protected readonly record = trackedState(
    () => this.recordId(),
    () => this.clinical.record(this.recordId()),
  );

  protected print(): void {
    window.print();
  }

  protected hasVitals(vitals: Vitals | undefined): boolean {
    return !!vitals && Object.values(vitals).some((value) => value !== undefined && value !== null);
  }

  /** Turns the vitals object into labelled, unit-bearing rows. */
  protected vitalList(source: Vitals) {
    const vitals = source as Record<string, number | undefined>;

    const rows = [
      { key: 'temperatureF', label: 'Temperature', unit: '°F' },
      { key: 'pulse', label: 'Pulse', unit: '/min' },
      { key: 'spo2', label: 'SpO₂', unit: '%' },
      { key: 'sugarMgDl', label: 'Blood sugar', unit: ' mg/dL' },
      { key: 'heightCm', label: 'Height', unit: ' cm' },
      { key: 'weightKg', label: 'Weight', unit: ' kg' },
    ];

    const list = rows
      .filter((row) => vitals[row.key] !== undefined)
      .map((row) => ({ label: row.label, value: `${vitals[row.key]}${row.unit}` }));

    // Blood pressure only makes sense as one reading, not two numbers.
    if (vitals['systolic'] && vitals['diastolic']) {
      list.unshift({
        label: 'Blood pressure',
        value: `${vitals['systolic']}/${vitals['diastolic']} mmHg`,
      });
    }

    return list;
  }
}
