import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lazyState, PatientService } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * The patient directory.
 *
 * The front desk's lookup: find someone by name, ID, mobile or email before
 * doing anything else for them. Unlike the doctor's list this covers the whole
 * hospital, because reception serves everyone who walks in.
 */
@Component({
  selector: 'mc-admin-patients',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Patients</h1>
          <p>{{ list.data()?.total ?? 0 }} registered across every branch.</p>
        </div>

        <div class="row row--wrap">
          <mc-search
            [value]="search()"
            placeholder="Name, PT-000001, mobile or email"
            (valueChange)="setSearch($event)"
          />
          <a class="btn btn--primary" routerLink="/admin/register">Register a patient</a>
        </div>
      </header>

      <div class="row row--wrap filters">
        <label class="field">
          <span class="sr-only">City</span>
          <select [ngModel]="city()" (ngModelChange)="setCity($event)">
            <option value="">Every city</option>
            @for (option of cities; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span class="sr-only">Blood group</span>
          <select [ngModel]="bloodGroup()" (ngModelChange)="setBloodGroup($event)">
            <option value="">Any blood group</option>
            @for (group of bloodGroups; track group) {
              <option [value]="group">{{ group }}</option>
            }
          </select>
        </label>
      </div>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="6"
        [skeletonHeight]="3.5"
        emptyTitle="No patients match"
        emptyBody="Try a partial name or the last few digits of a mobile number."
        (retry)="list.load()"
      >
        <div slot="empty-action">
          <a class="btn btn--primary" routerLink="/admin/register">Register them instead</a>
        </div>

        <div class="card card--flush" [class.is-reloading]="list.reloading()">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Age / gender</th>
                  <th>Blood</th>
                  <th>Contact</th>
                  <th>City</th>
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
                    <td class="text-sm">
                      {{ patient.mobile }}
                      <div class="muted text-xs truncate">{{ patient.email }}</div>
                    </td>
                    <td class="text-sm">{{ patient.city }}</td>
                    <td class="cell-actions">
                      <a class="btn btn--outline btn--sm" [routerLink]="['/admin/patients', patient.id]">
                        Open
                      </a>
                      <a
                        class="btn btn--ghost btn--sm"
                        routerLink="/admin/appointments"
                        [queryParams]="{ q: patient.id }"
                      >
                        Visits
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
    .filters {
      gap: var(--gap-sm);
    }

    .filters .field {
      max-width: 12rem;
      min-width: 9rem;
    }

    td .truncate {
      max-width: 18ch;
    }
  `,
})
export class AdminPatientsPage {
  private readonly patients = inject(PatientService);

  protected readonly cities = ['Mumbai', 'Bengaluru', 'Lucknow'];
  protected readonly bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  protected readonly search = signal('');
  protected readonly city = signal('');
  protected readonly bloodGroup = signal('');
  protected readonly page = signal(1);

  protected readonly list = lazyState(() =>
    this.patients.list({
      q: this.search(),
      city: this.city(),
      bloodGroup: this.bloodGroup(),
      page: this.page(),
      limit: 15,
      sort: 'name',
    }),
  );

  constructor() {
    void this.list.load();
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.reset();
  }

  protected setCity(value: string): void {
    this.city.set(value);
    this.reset();
  }

  protected setBloodGroup(value: string): void {
    this.bloodGroup.set(value);
    this.reset();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.list.load();
  }

  private reset(): void {
    this.page.set(1);
    void this.list.load();
  }
}
