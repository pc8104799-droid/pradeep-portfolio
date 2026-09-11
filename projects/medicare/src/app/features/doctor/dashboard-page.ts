import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AppointmentService,
  AuthService,
  lazyState,
  StatsService,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CHARTS } from '../../shared/ui/charts';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * The doctor's morning screen.
 *
 * Ordered the way a clinic day actually runs: who is waiting right now, then
 * today's numbers, then the longer view. The queue card is first because it is
 * the only thing on this page that is time-critical.
 */
@Component({
  selector: 'mc-doctor-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CHARTS, ...MC_PIPES],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DoctorDashboardPage {
  private readonly stats = inject(StatsService);
  private readonly appointments = inject(AppointmentService);

  protected readonly auth = inject(AuthService);

  private readonly doctorId = this.auth.profileId() ?? '';

  protected readonly dashboard = lazyState(() => this.stats.doctor(this.doctorId));
  protected readonly queue = lazyState(() => this.appointments.queue());

  protected readonly firstName = computed(
    () => this.auth.user()?.name.replace(/^Dr\.?\s+/i, '').split(' ')[0] ?? 'Doctor',
  );

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  /** Whoever is in the room, or the next person to be called. */
  protected readonly nextPatient = computed(() => {
    const items = this.queue.data()?.items ?? [];

    return (
      items.find((row) => row.queueStatus === 'in-consultation') ??
      items.find((row) => row.queueStatus === 'waiting' || row.queueStatus === 'called') ??
      null
    );
  });

  constructor() {
    void this.dashboard.load();
    void this.queue.load();
  }

  protected reload(): void {
    void this.dashboard.load();
    void this.queue.load();
  }
}
