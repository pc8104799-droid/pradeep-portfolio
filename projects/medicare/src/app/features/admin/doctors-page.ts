import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService, lazyState } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * The consultant list, as reception needs it.
 *
 * The question at the desk is "who can see this person, and when" — so the
 * column that matters is the next free slot, not the star rating. A doctor with
 * no slots for three weeks is flagged, because that is the one reception has to
 * work around.
 */
@Component({
  selector: 'mc-admin-doctors',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Doctors</h1>
          <p>{{ list.data()?.total ?? 0 }} consultants, with the next slot each has free.</p>
        </div>

        <mc-search
          [value]="search()"
          placeholder="Name, specialisation or department"
          (valueChange)="setSearch($event)"
        />
      </header>

      <div class="row row--wrap filters">
        <label class="field">
          <span class="sr-only">Department</span>
          <select [ngModel]="departmentId()" (ngModelChange)="setDepartment($event)">
            <option value="">All departments</option>
            @for (department of catalog.departments(); track department.id) {
              <option [value]="department.id">{{ department.name }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span class="sr-only">Branch</span>
          <select [ngModel]="branchId()" (ngModelChange)="setBranch($event)">
            <option value="">Any branch</option>
            @for (branch of catalog.branches(); track branch.id) {
              <option [value]="branch.id">{{ branch.name }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span class="sr-only">Free on</span>
          <input
            type="date"
            [min]="today"
            [ngModel]="availableOn()"
            (ngModelChange)="setAvailableOn($event)"
          />
        </label>

        @if (availableOn()) {
          <button type="button" class="btn btn--ghost btn--sm" (click)="setAvailableOn('')">
            Clear the date
          </button>
        }
      </div>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="6"
        [skeletonHeight]="3.5"
        emptyTitle="No doctors match"
        emptyBody="Clear the date filter, or try another department."
        (retry)="list.load()"
      >
        <div class="card card--flush" [class.is-reloading]="list.reloading()">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Department</th>
                  <th>Experience</th>
                  <th class="right">Fee</th>
                  <th>Next free slot</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (doctor of list.data()?.items ?? []; track doctor.id) {
                  <tr>
                    <td>
                      <mc-person [name]="doctor.name" [meta]="doctor.specialization" />
                      <div class="mono text-xs muted">Reg. {{ doctor.registrationNumber }}</div>
                    </td>
                    <td class="text-sm">
                      {{ doctor.departmentName }}
                      @if (doctor.acceptsOnline) {
                        <div><span class="badge badge--info">Online too</span></div>
                      }
                    </td>
                    <td class="num">{{ doctor.experience }} yrs</td>
                    <td class="right num">
                      <strong>{{ doctor.consultationFee | inr }}</strong>
                      <div class="muted text-xs">{{ doctor.followUpFee | inr }} follow-up</div>
                    </td>
                    <td>
                      @if (doctor.nextAvailable; as next) {
                        <strong class="num">{{ next.date | day: 'short' }}</strong>
                        <div class="muted text-xs num">{{ next.time | clock }}</div>
                      } @else {
                        <span class="badge badge--warning">Nothing for 3 weeks</span>
                      }
                    </td>
                    <td class="cell-actions">
                      <a
                        class="btn btn--outline btn--sm"
                        routerLink="/admin/appointments"
                        [queryParams]="{ q: doctor.name }"
                      >
                        Their day
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

      <mc-note tone="info">
        Fees, departments and registration numbers are hospital records rather than desk settings.
        A doctor sets their own working hours and leave from their panel, which is what decides
        the slots shown here.
      </mc-note>
    </section>
  `,
  styles: `
    .filters {
      gap: var(--gap-sm);
    }

    .filters .field {
      max-width: 13rem;
      min-width: 9rem;
    }

    .right {
      text-align: right;
    }
  `,
})
export class AdminDoctorsPage {
  protected readonly catalog = inject(CatalogService);
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly search = signal('');
  protected readonly departmentId = signal('');
  protected readonly branchId = signal('');
  protected readonly availableOn = signal('');
  protected readonly page = signal(1);

  protected readonly list = lazyState(() =>
    this.catalog.doctors({
      q: this.search(),
      departmentId: this.departmentId(),
      branchId: this.branchId(),
      availableOn: this.availableOn(),
      page: this.page(),
      limit: 15,
      sort: 'name',
    }),
  );

  constructor() {
    void this.catalog.loadReference().catch(() => undefined);
    void this.list.load();
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.reset();
  }

  protected setDepartment(value: string): void {
    this.departmentId.set(value);
    this.reset();
  }

  protected setBranch(value: string): void {
    this.branchId.set(value);
    this.reset();
  }

  protected setAvailableOn(value: string): void {
    this.availableOn.set(value);
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
