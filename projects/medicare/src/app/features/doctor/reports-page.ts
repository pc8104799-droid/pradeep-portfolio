import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  ClinicalService,
  lazyState,
  ToastService,
  type TestRequest,
  type TestStatus,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const NEXT_STATUS: Partial<Record<TestStatus, { next: TestStatus; label: string }>> = {
  requested: { next: 'scheduled', label: 'Schedule' },
  scheduled: { next: 'sample-collected', label: 'Sample taken' },
  'sample-collected': { next: 'processing', label: 'Send to lab' },
  processing: { next: 'completed', label: 'Mark complete' },
};

/**
 * Lab work, both halves of it.
 *
 * Tests the doctor ordered and is waiting on, and reports the lab has released.
 * Keeping them on one screen is the point: "where is that blood test" is a
 * single question, and the answer is in one of the two lists.
 */
@Component({
  selector: 'mc-doctor-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Reports & tests</h1>
          <p>What you have ordered, and what has come back.</p>
        </div>

        <mc-search
          [value]="search()"
          placeholder="Test, patient or lab"
          (valueChange)="setSearch($event)"
        />
      </header>

      <!-- Pending lab work -->
      <article class="card card--flush">
        <header class="card__head">
          <h2>Awaiting results ({{ pending().length }})</h2>
          <button type="button" class="btn btn--ghost btn--sm" (click)="tests.load()">Refresh</button>
        </header>

        <mc-data-state
          [busy]="tests.loading()"
          [error]="tests.error()"
          [skeletonLines]="3"
          [skeletonHeight]="3"
          errorTitle="Could not load your test requests"
          (retry)="tests.load()"
        >
          @if (pending().length) {
            <div class="table-wrap" [class.is-reloading]="action.busy()">
              <table class="data">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Patient</th>
                    <th>Ordered</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (test of pending(); track test.id) {
                    <tr>
                      <td>
                        <strong>{{ test.testName }}</strong>
                        <div class="muted text-xs">{{ test.clinicalReason }}</div>
                      </td>
                      <td>
                        <a [routerLink]="['/doctor/patients', test.patientId]">{{ test.patientName }}</a>
                      </td>
                      <td class="num">{{ test.requestedAt | day: 'short' }}</td>
                      <td>
                        @if (test.priority === 'urgent') {
                          <mc-status status="urgent" />
                        } @else {
                          <span class="badge">Routine</span>
                        }
                      </td>
                      <td><mc-status [status]="test.status" /></td>
                      <td class="cell-actions">
                        @if (nextFor(test); as step) {
                          <button
                            type="button"
                            class="btn btn--outline btn--sm"
                            [disabled]="action.busy()"
                            (click)="advance(test, step.next)"
                          >
                            {{ step.label }}
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="card__body">
              <p class="muted">Nothing outstanding — every test you ordered has been reported.</p>
            </div>
          }
        </mc-data-state>
      </article>

      <!-- Released reports -->
      <mc-data-state
        [busy]="reports.loading()"
        [error]="reports.error()"
        [empty]="reports.empty()"
        [skeletonLines]="4"
        [skeletonHeight]="3.5"
        emptyTitle="No reports yet"
        emptyBody="Results appear here once the lab releases them."
        (retry)="reports.load()"
      >
        <article class="card card--flush" [class.is-reloading]="reports.reloading()">
          <header class="card__head">
            <h2>Released reports</h2>
            <span class="muted text-sm">{{ reports.data()?.total ?? 0 }} in total</span>
          </header>

          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Patient</th>
                  <th>Result</th>
                  <th>Reported</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (report of reports.data()?.items ?? []; track report.id) {
                  <tr>
                    <td>
                      <strong>{{ report.testName }}</strong>
                      <div class="muted text-xs">{{ report.lab }}</div>
                    </td>
                    <td>
                      <a [routerLink]="['/doctor/patients', report.patientId]">{{ report.patientName }}</a>
                    </td>
                    <td class="result">
                      <span class="truncate" [title]="report.result">{{ report.result }}</span>
                      <span class="muted text-xs">Ref: {{ report.referenceRange }}</span>
                    </td>
                    <td class="num">{{ report.reportedOn | day: 'short' }}</td>
                    <td>
                      <mc-status [status]="report.status" />
                      @if (!report.doctorComments) {
                        <span class="badge badge--warning">Not reviewed</span>
                      }
                    </td>
                    <td class="cell-actions">
                      <a class="btn btn--outline btn--sm" [routerLink]="['/doctor/reports', report.id]">
                        {{ report.doctorComments ? 'Open' : 'Review' }}
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </article>

        @if (reports.data(); as page) {
          <mc-paginator [page]="page.page" [pages]="page.pages" [total]="page.total" (pageChange)="setPage($event)" />
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    h2 {
      font-size: 0.95rem;
    }

    .result {
      max-width: 20rem;
    }

    .result span {
      display: block;
    }

    td a {
      color: var(--primary);
      font-weight: 600;
    }

    td .badge + .badge,
    td mc-status + .badge {
      margin-left: 0.25rem;
    }
  `,
})
export class DoctorReportsPage {
  private readonly clinical = inject(ClinicalService);
  private readonly toasts = inject(ToastService);

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly action = new ActionState();

  protected readonly tests = lazyState(() =>
    this.clinical.testRequests({ limit: 50, sort: '-requestedAt' }),
  );

  protected readonly reports = lazyState(() =>
    this.clinical.reports({ q: this.search(), page: this.page(), limit: 12, sort: '-reportedOn' }),
  );

  constructor() {
    void this.tests.load();
    void this.reports.load();
  }

  protected pending(): TestRequest[] {
    return (this.tests.data()?.items ?? []).filter((test) => test.status !== 'report-available');
  }

  protected nextFor(test: TestRequest) {
    return NEXT_STATUS[test.status] ?? null;
  }

  /** Nudges a request along its lab workflow. */
  protected async advance(test: TestRequest, status: TestStatus): Promise<void> {
    const updated = await this.action.run(() => this.clinical.updateTestStatus(test.id, status));
    if (!updated) {
      this.toasts.error('Could not update the test', this.action.error()?.message);
      return;
    }

    this.toasts.success(`${test.testName} → ${status.replaceAll('-', ' ')}`);
    void this.tests.load();
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    void this.reports.load();
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.reports.load();
  }
}
