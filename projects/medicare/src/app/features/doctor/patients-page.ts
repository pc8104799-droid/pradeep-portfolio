import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lazyState, PatientService } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * The doctor's patient list.
 *
 * Scoped by the API to people this doctor has actually treated — not the whole
 * hospital. That is enforced server-side; this page simply renders what it is
 * allowed to see.
 */
@Component({
  selector: 'mc-doctor-patients',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Patients</h1>
          <p>
            {{ list.data()?.total ?? 0 }} people you have treated. Search by name, ID, mobile or email.
          </p>
        </div>

        <mc-search
          [value]="search()"
          placeholder="Name, PT-000001, mobile…"
          (valueChange)="setSearch($event)"
        />
      </header>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="5"
        [skeletonHeight]="3.5"
        emptyTitle="No patients match"
        emptyBody="Patients appear here once they have booked with you."
        (retry)="list.load()"
      >
        <div class="card card--flush" [class.is-reloading]="list.reloading()">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Age / gender</th>
                  <th>Blood</th>
                  <th>Allergies</th>
                  <th>Conditions</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (patient of list.data()?.items ?? []; track patient.id) {
                  <tr>
                    <td>
                      <mc-person [name]="patient.name" [meta]="patient.id" />
                    </td>
                    <td class="num">{{ patient.age }} · {{ patient.gender | label }}</td>
                    <td>
                      <span class="badge badge--danger">{{ patient.bloodGroup }}</span>
                    </td>
                    <td [class.warn]="patient.allergies.length">
                      {{ patient.allergies | listOr: '—' }}
                    </td>
                    <td>{{ patient.conditions | listOr: '—' }}</td>
                    <td class="cell-actions">
                      <a class="btn btn--outline btn--sm" [routerLink]="['/doctor/patients', patient.id]">
                        Open record
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
    td.warn {
      color: var(--warning);
      font-weight: 600;
    }
  `,
})
export class DoctorPatientsPage {
  private readonly patients = inject(PatientService);

  protected readonly search = signal('');
  protected readonly page = signal(1);

  protected readonly list = lazyState(() =>
    this.patients.list({ q: this.search(), page: this.page(), limit: 15, sort: 'name' }),
  );

  constructor() {
    void this.list.load();
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
