import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClinicalService, lazyState } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/** Everything this doctor has prescribed, newest first. */
@Component({
  selector: 'mc-doctor-prescriptions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Prescriptions issued</h1>
          <p>{{ list.data()?.total ?? 0 }} written by you, across every patient.</p>
        </div>

        <mc-search
          [value]="search()"
          placeholder="Patient, diagnosis or RX ID"
          (valueChange)="setSearch($event)"
        />
      </header>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="5"
        [skeletonHeight]="3.5"
        emptyTitle="No prescriptions yet"
        emptyBody="Prescriptions you write during a consultation are listed here."
        (retry)="list.load()"
      >
        <div class="card card--flush" [class.is-reloading]="list.reloading()">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Issued</th>
                  <th>Patient</th>
                  <th>Diagnosis</th>
                  <th>Medicines</th>
                  <th>Follow-up</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (rx of list.data()?.items ?? []; track rx.id) {
                  <tr>
                    <td>
                      <strong class="num">{{ rx.issuedAt | day: 'short' }}</strong>
                      <div class="mono text-xs muted">{{ rx.id }}</div>
                    </td>
                    <td>
                      <mc-person [name]="rx.patientName" [meta]="rx.patientId" size="sm" />
                    </td>
                    <td class="diagnosis">
                      <span class="truncate" [title]="rx.diagnosis">{{ rx.diagnosis }}</span>
                    </td>
                    <td>
                      <span class="badge">{{ rx.medicines.length }} items</span>
                      <div class="muted text-xs truncate">
                        {{ medicineNames(rx.medicines) }}
                      </div>
                    </td>
                    <td class="num">
                      {{ rx.followUpDate ? (rx.followUpDate | day: 'short') : '—' }}
                    </td>
                    <td class="cell-actions">
                      <a class="btn btn--outline btn--sm" [routerLink]="['/doctor/prescriptions', rx.id]">
                        Open
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        @if (list.data(); as page) {
          <mc-paginator [page]="page.page" [pages]="page.pages" [total]="page.total" (pageChange)="setPage($event)" />
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    .diagnosis {
      max-width: 18rem;
    }

    .diagnosis span,
    td .truncate {
      display: block;
      max-width: 22ch;
    }
  `,
})
export class DoctorPrescriptionsPage {
  private readonly clinical = inject(ClinicalService);

  protected readonly search = signal('');
  protected readonly page = signal(1);

  protected readonly list = lazyState(() =>
    this.clinical.prescriptions({ q: this.search(), page: this.page(), limit: 15, sort: '-issuedAt' }),
  );

  constructor() {
    void this.list.load();
  }

  /** First two medicine names, for the table's secondary line. */
  protected medicineNames(medicines: readonly { name: string }[]): string {
    const names = medicines.slice(0, 2).map((medicine) => medicine.name);
    return medicines.length > 2 ? `${names.join(', ')} +${medicines.length - 2}` : names.join(', ');
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    void this.list.load();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.list.load();
  }
}
