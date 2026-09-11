import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClinicalService, lazyState, TEST_CATEGORIES } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * Lab reports, plus the tests that have been ordered but not yet reported.
 *
 * Both lists are here because a patient asking "where is my blood test" does
 * not know whether the answer is "ready" or "still at the lab" — showing only
 * finished reports makes the pending ones look lost.
 */
@Component({
  selector: 'mc-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Lab reports</h1>
          <p>Results, reference ranges and what your doctor said about them.</p>
        </div>

        <mc-search [value]="search()" placeholder="Test name, lab or ID" (valueChange)="setSearch($event)" />
      </header>

      @if (pendingList(); as pending) {
        @if (pending.length) {
          <article class="card card--pad card--rail card--warning">
            <h2>{{ pending.length }} test{{ pending.length > 1 ? 's' : '' }} still with the lab</h2>

            <ul class="pending">
              @for (test of pending; track test.id) {
                <li>
                  <div>
                    <strong>{{ test.testName }}</strong>
                    <span class="muted text-xs">
                      Ordered by {{ test.doctorName }} · {{ test.requestedAt | day: 'short' }}
                    </span>
                  </div>
                  <div class="row">
                    @if (test.priority === 'urgent') {
                      <mc-status status="urgent" />
                    }
                    <mc-status [status]="test.status" />
                  </div>
                </li>
              }
            </ul>
          </article>
        }
      }

      <div class="row row--wrap" role="group" aria-label="Filter by test type">
        <button type="button" class="chip" [class.is-active]="!category()" (click)="setCategory('')">
          All types
        </button>
        @for (option of categories; track option.id) {
          <button
            type="button"
            class="chip"
            [class.is-active]="category() === option.id"
            (click)="setCategory(option.id)"
          >
            {{ option.label }}
          </button>
        }
      </div>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="4"
        [skeletonHeight]="4"
        emptyTitle="No reports yet"
        emptyBody="Results appear here as soon as the lab releases them."
        (retry)="list.load()"
      >
        <div class="card card--flush" [class.is-reloading]="list.reloading()">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Reported</th>
                  <th>Result</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (report of list.data()?.items ?? []; track report.id) {
                  <tr>
                    <td>
                      <strong>{{ report.testName }}</strong>
                      <div class="muted text-xs">
                        {{ report.lab }} · ordered by {{ report.doctorName }}
                      </div>
                    </td>
                    <td class="num">{{ report.reportedOn | day: 'short' }}</td>
                    <td class="result">
                      <span class="truncate" [title]="report.result">{{ report.result }}</span>
                      <span class="muted text-xs">Ref: {{ report.referenceRange }}</span>
                    </td>
                    <td><mc-status [status]="report.status" /></td>
                    <td class="cell-actions">
                      <a class="btn btn--outline btn--sm" [routerLink]="['/patient/reports', report.id]">
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
    .pending {
      display: grid;
      gap: 0.5rem;
      margin-block: 0.6rem;
    }

    .pending li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-sm);
      flex-wrap: wrap;
    }

    .pending strong {
      display: block;
      font-size: 0.88rem;
    }

    .result {
      max-width: 22rem;
    }

    .result span {
      display: block;
    }
  `,
})
export class ReportsPage {
  private readonly clinical = inject(ClinicalService);

  protected readonly categories = TEST_CATEGORIES;
  protected readonly search = signal('');
  protected readonly category = signal('');
  protected readonly page = signal(1);

  protected readonly list = lazyState(() =>
    this.clinical.reports({
      q: this.search(),
      category: this.category(),
      page: this.page(),
      limit: 12,
      sort: '-reportedOn',
    }),
  );

  /** Tests ordered but not yet released, newest first. */
  private readonly tests = lazyState(() =>
    this.clinical.testRequests({ sort: '-requestedAt', limit: 50 }),
  );

  constructor() {
    void this.list.load();
    void this.tests.load();
  }

  protected pendingList() {
    return (this.tests.data()?.items ?? []).filter((test) => test.status !== 'report-available');
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    void this.list.load();
  }

  protected setCategory(category: string): void {
    this.category.set(category);
    this.page.set(1);
    void this.list.load();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.list.load();
  }
}
