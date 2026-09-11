import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClinicalService, lazyState } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * Every prescription this patient has been given.
 *
 * The action that matters is on each card: turning a prescription into a
 * basket of the exact medicines, at today's prices, in one click.
 */
@Component({
  selector: 'mc-prescriptions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Prescriptions</h1>
          <p>Each one lists the medicine, the dose, and how long to take it for.</p>
        </div>

        <mc-search [value]="search()" placeholder="Diagnosis, doctor or ID" (valueChange)="setSearch($event)" />
      </header>

      <mc-data-state
        [busy]="list.loading()"
        [error]="list.error()"
        [empty]="list.empty()"
        [skeletonLines]="3"
        [skeletonHeight]="6"
        emptyTitle="No prescriptions yet"
        emptyBody="A prescription appears here as soon as a doctor completes your consultation."
        (retry)="list.load()"
      >
        <div slot="empty-action">
          <a class="btn btn--primary" routerLink="/patient/doctors">Book a consultation</a>
        </div>

        <div class="grid grid--wide" [class.is-reloading]="list.reloading()">
          @for (rx of list.data()?.items ?? []; track rx.id) {
            <article class="rx card card--pad">
              <header class="rx__head">
                <div>
                  <h2>{{ rx.diagnosis }}</h2>
                  <span class="muted text-sm">{{ rx.doctorName }} · {{ rx.departmentName }}</span>
                </div>
                <mc-status [status]="rx.status" />
              </header>

              <ul class="rx__meds">
                @for (medicine of rx.medicines.slice(0, 3); track medicine.name) {
                  <li>
                    <strong>{{ medicine.name }}</strong>
                    <span class="muted text-xs">
                      {{ medicine.strength }} · {{ medicine.frequency }} · {{ medicine.duration }}
                    </span>
                  </li>
                }

                @if (rx.medicines.length > 3) {
                  <li class="muted text-sm">+ {{ rx.medicines.length - 3 }} more</li>
                }
              </ul>

              <footer class="rx__foot">
                <div>
                  <span class="mono text-xs">{{ rx.id }}</span>
                  <span class="muted text-xs"> · issued {{ rx.issuedAt | day: 'short' }}</span>
                  @if (rx.followUpDate) {
                    <span class="muted text-xs"> · follow-up {{ rx.followUpDate | day: 'short' }}</span>
                  }
                </div>

                <div class="row">
                  <a class="btn btn--outline btn--sm" [routerLink]="['/patient/prescriptions', rx.id]">Open</a>
                  <a
                    class="btn btn--primary btn--sm"
                    routerLink="/patient/pharmacy"
                    [queryParams]="{ prescriptionId: rx.id }"
                  >
                    Order medicines
                  </a>
                </div>
              </footer>
            </article>
          }
        </div>

        @if (list.data(); as page) {
          <mc-paginator [page]="page.page" [pages]="page.pages" [total]="page.total" (pageChange)="setPage($event)" />
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    .rx {
      display: grid;
      gap: 0.7rem;
      align-content: start;
      transition: border-color var(--t) var(--ease);
    }

    .rx:hover {
      border-color: var(--primary);
    }

    .rx__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--gap-sm);
    }

    .rx__head h2 {
      font-size: 0.98rem;
    }

    .rx__meds {
      display: grid;
      gap: 0.35rem;
      padding: 0.6rem 0.7rem;
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }

    .rx__meds strong {
      display: block;
      font-size: 0.86rem;
    }

    .rx__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-sm);
      flex-wrap: wrap;
      padding-top: 0.6rem;
      border-top: 1px solid var(--stroke);
    }
  `,
})
export class PrescriptionsPage {
  private readonly clinical = inject(ClinicalService);

  protected readonly search = signal('');
  protected readonly page = signal(1);

  protected readonly list = lazyState(() =>
    this.clinical.prescriptions({ q: this.search(), page: this.page(), limit: 9, sort: '-issuedAt' }),
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
