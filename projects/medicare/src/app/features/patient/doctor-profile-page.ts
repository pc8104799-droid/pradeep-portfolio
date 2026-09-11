import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService, DAY_KEYS, DAY_LABELS, trackedState } from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * A doctor's public profile.
 *
 * Everything a patient weighs before booking: what they treat, what it costs,
 * which days they consult, and the next free slot. The weekly schedule is shown
 * as published hours rather than as bookable slots — the slot picker in the
 * booking flow is the thing that knows what is actually free.
 */
@Component({
  selector: 'mc-doctor-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_PIPES],
  template: `
    <section class="page">
      <mc-data-state
        [busy]="doctor.loading()"
        [error]="doctor.error()"
        [skeletonLines]="3"
        [skeletonHeight]="8"
        errorTitle="That doctor could not be loaded"
        (retry)="doctor.load()"
      >
        @if (doctor.data(); as profile) {
          <header class="page__head">
            <div class="row">
              <mc-person [name]="profile.name" [meta]="profile.qualification" size="lg" />
            </div>

            <div class="row row--wrap">
              <a class="btn btn--outline" routerLink="/patient/doctors">← All doctors</a>
              <a class="btn btn--primary" routerLink="/patient/book" [queryParams]="{ doctorId: profile.id }">
                Book an appointment
              </a>
            </div>
          </header>

          <div class="split">
            <div class="stack">
              <article class="card card--pad stack">
                <div class="row row--wrap">
                  <span class="badge badge--primary">{{ profile.departmentName }}</span>
                  <span class="badge">{{ profile.specialization }}</span>
                  <span class="badge">{{ profile.experience }} years</span>
                  <span class="badge badge--warning">★ {{ profile.rating }} · {{ profile.ratingCount }}</span>
                  @if (profile.acceptsOnline) {
                    <span class="badge badge--info">Online consults</span>
                  }
                </div>

                <p>{{ profile.about }}</p>

                <div class="kv">
                  <div class="kv__row">
                    <span class="kv__key">Registration</span>
                    <span class="kv__value mono">{{ profile.registrationNumber }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Languages</span>
                    <span class="kv__value">{{ profile.languages | listOr }}</span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">Consultations</span>
                    <span class="kv__value num">{{ profile.consultations }} completed</span>
                  </div>
                </div>
              </article>

              <article class="card card--flush">
                <header class="card__head"><h2>Weekly schedule</h2></header>

                @if (profile.availability; as availability) {
                  <ul class="week">
                    @for (day of days; track day.key) {
                      <li [class.is-off]="!schedule(availability, day.key)?.working">
                        <strong>{{ day.label }}</strong>

                        @if (schedule(availability, day.key); as entry) {
                          @if (entry.working) {
                            <span class="week__hours">
                              @for (window of entry.windows; track window.start) {
                                <span class="badge">{{ window.start | clock }} – {{ window.end | clock }}</span>
                              }
                            </span>
                          } @else {
                            <span class="muted text-sm">Not consulting</span>
                          }
                        } @else {
                          <span class="muted text-sm">Not consulting</span>
                        }
                      </li>
                    }
                  </ul>

                  <footer class="card__foot text-sm muted">
                    {{ availability.slotMinutes }}-minute slots · up to
                    {{ availability.maxPerSlot }} patient{{ availability.maxPerSlot > 1 ? 's' : '' }} per slot
                  </footer>
                } @else {
                  <div class="card__body">
                    <p class="muted">No schedule published. Call the branch to book.</p>
                  </div>
                }
              </article>

              @if (profile.leaves?.length) {
                <article class="card card--pad card--rail card--warning">
                  <h2>Upcoming leave</h2>
                  <ul class="stack--sm">
                    @for (leave of profile.leaves!; track leave.id) {
                      <li>
                        <strong>{{ leave.from | day }} – {{ leave.to | day }}</strong>
                        <span class="muted text-sm"> · {{ leave.reason }}</span>
                      </li>
                    }
                  </ul>
                  <p class="text-sm">Those dates cannot be booked.</p>
                </article>
              }
            </div>

            <aside class="stack">
              <article class="card card--pad booking">
                <span class="text-xs muted">Consultation fee</span>
                <strong class="booking__fee num">{{ profile.consultationFee | inr }}</strong>
                <span class="muted text-sm">Follow-up within 30 days · {{ profile.followUpFee | inr }}</span>

                <hr class="divider" />

                @if (profile.nextAvailable; as next) {
                  <p class="text-sm">
                    Next free slot
                    <strong>{{ next.date | day }} at {{ next.time | clock }}</strong>
                  </p>
                  <a
                    class="btn btn--primary btn--block"
                    routerLink="/patient/book"
                    [queryParams]="{ doctorId: profile.id, date: next.date, time: next.time }"
                  >
                    Book this slot
                  </a>
                } @else {
                  <p class="text-sm muted">No free slots in the next three weeks.</p>
                }

                <p class="text-xs muted">
                  A booking is held for you as soon as payment goes through. Cancelling raises an
                  automatic refund.
                </p>
              </article>

              <article class="card card--pad stack--sm">
                <h2>Where they consult</h2>

                @for (branch of profile.branches ?? []; track branch.id) {
                  <div class="branch">
                    <strong>{{ branch.name }}</strong>
                    <span class="muted text-sm">{{ branch.address }}</span>
                    <span class="text-sm">{{ branch.phone }} · {{ branch.hours }}</span>
                    @if (branch.emergency) {
                      <span class="badge badge--danger">24x7 emergency</span>
                    }
                  </div>
                }
              </article>
            </aside>
          </div>
        }
      </mc-data-state>
    </section>
  `,
  styles: `
    .week li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap-sm);
      padding: 0.55rem var(--pad-card);
      border-bottom: 1px solid var(--stroke);
      flex-wrap: wrap;
    }

    .week li:last-child {
      border-bottom: 0;
    }

    .week li.is-off {
      color: var(--ink-3);
    }

    .week strong {
      font-size: 0.88rem;
      font-weight: 600;
    }

    .week__hours {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
    }

    .booking {
      display: grid;
      gap: 0.35rem;
      align-content: start;
    }

    .booking__fee {
      font-family: var(--font-display);
      font-size: 1.8rem;
      line-height: 1.1;
    }

    .booking .divider {
      margin-block: 0.5rem;
    }

    .branch {
      display: grid;
      gap: 0.15rem;
      justify-items: start;
      padding-bottom: 0.6rem;
      border-bottom: 1px solid var(--stroke);
    }

    .branch:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    @media (min-width: 1080px) {
      aside {
        position: sticky;
        top: calc(var(--header-h) + 1rem);
      }
    }
  `,
})
export class DoctorProfilePage {
  /** Bound from the route path by `withComponentInputBinding`. */
  readonly doctorId = input.required<string>();

  private readonly catalog = inject(CatalogService);

  protected readonly doctor = trackedState(
    () => this.doctorId(),
    () => this.catalog.doctor(this.doctorId()),
  );

  protected readonly days = DAY_KEYS.map((key) => ({ key, label: DAY_LABELS[key] }));

  /** Narrow the partial schedule record for the template. */
  protected schedule(
    availability: { schedule: Partial<Record<string, { working: boolean; windows: readonly { start: string; end: string }[] }>> },
    day: string,
  ) {
    return availability.schedule[day] ?? null;
  }
}
