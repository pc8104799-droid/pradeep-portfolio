import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService, lazyState } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * Departments and branches.
 *
 * Reference rather than administration: reception looks this up to answer "do
 * we do that here, and what does it cost" without walking to a noticeboard.
 * Editing a department is a hospital-systems job, so nothing here is a form.
 */
@Component({
  selector: 'mc-admin-departments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Departments & branches</h1>
          <p>What the hospital treats, where, and from what fee.</p>
        </div>

        <a class="btn btn--outline" routerLink="/admin/doctors">All doctors →</a>
      </header>

      <!-- Branches first: the smaller, more concrete list. -->
      <mc-data-state
        [busy]="branches.loading()"
        [error]="branches.error()"
        [skeletonLines]="2"
        [skeletonHeight]="6"
        errorTitle="Branches did not load"
        (retry)="branches.load()"
      >
        <div class="grid grid--wide">
          @for (branch of branches.data()?.items ?? []; track branch.id) {
            <article class="branch card card--pad">
              <header class="branch__head">
                <div>
                  <h2>{{ branch.name }}</h2>
                  <span class="muted text-sm">{{ branch.city }}, {{ branch.state }}</span>
                </div>

                @if (branch.emergency) {
                  <span class="badge badge--danger">24x7 emergency</span>
                } @else {
                  <span class="badge">{{ branch.hours }}</span>
                }
              </header>

              <p class="text-sm">{{ branch.address }}</p>

              <div class="kv">
                <div class="kv__row">
                  <span class="kv__key">Phone</span>
                  <span class="kv__value">{{ branch.phone }}</span>
                </div>
                <div class="kv__row">
                  <span class="kv__key">Beds</span>
                  <span class="kv__value num">{{ branch.beds }}</span>
                </div>
                <div class="kv__row">
                  <span class="kv__key">Hours</span>
                  <span class="kv__value">{{ branch.hours }}</span>
                </div>
                <div class="kv__row">
                  <span class="kv__key">Branch ID</span>
                  <span class="kv__value mono">{{ branch.id }}</span>
                </div>
              </div>
            </article>
          }
        </div>
      </mc-data-state>

      <mc-data-state
        [busy]="departments.loading()"
        [error]="departments.error()"
        [empty]="departments.empty()"
        [skeletonLines]="5"
        [skeletonHeight]="3"
        emptyTitle="No departments"
        emptyBody="Departments are seeded with the hospital."
        (retry)="departments.load()"
      >
        <article class="card card--flush">
          <header class="card__head">
            <h2>Departments</h2>
            <span class="muted text-sm">{{ departments.data()?.total ?? 0 }} in total</span>
          </header>

          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>What it covers</th>
                  <th class="right">Doctors</th>
                  <th class="right">From</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (department of departments.data()?.items ?? []; track department.id) {
                  <tr>
                    <td>
                      <strong>{{ department.name }}</strong>
                      <div class="mono text-xs muted">{{ department.code }}</div>
                    </td>
                    <td class="summary">
                      <span class="text-sm">{{ department.summary }}</span>
                    </td>
                    <td class="right num">{{ department.doctorCount ?? 0 }}</td>
                    <td class="right num">
                      {{ department.fromFee ? (department.fromFee | inr) : '—' }}
                    </td>
                    <td class="cell-actions">
                      <a
                        class="btn btn--outline btn--sm"
                        routerLink="/admin/doctors"
                        [queryParams]="{ departmentId: department.id }"
                      >
                        Doctors
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </article>
      </mc-data-state>
    </section>
  `,
  styles: `
    h2 {
      font-size: 0.95rem;
    }

    .right {
      text-align: right;
    }

    .branch {
      display: grid;
      gap: 0.6rem;
      align-content: start;
    }

    .branch__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--gap-sm);
    }

    .branch__head h2 {
      font-size: 1rem;
    }

    .summary {
      max-width: 34rem;
    }
  `,
})
export class AdminDepartmentsPage {
  private readonly catalog = inject(CatalogService);

  protected readonly branches = lazyState(() => this.catalog.branchList());
  protected readonly departments = lazyState(() => this.catalog.departmentsPage({ sort: 'name' }));

  constructor() {
    void this.branches.load();
    void this.departments.load();
  }
}
