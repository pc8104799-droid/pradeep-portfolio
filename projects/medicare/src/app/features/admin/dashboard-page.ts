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
 * The reception desk's home screen.
 *
 * Built around the day in front of them, not lifetime totals: who is expected,
 * who has not arrived, what is unpaid, which departments are busy. The long
 * view is underneath, where it belongs.
 */
@Component({
  selector: 'mc-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CHARTS, ...MC_PIPES],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class AdminDashboardPage {
  private readonly stats = inject(StatsService);
  private readonly appointments = inject(AppointmentService);

  protected readonly auth = inject(AuthService);
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly dashboard = lazyState(() => this.stats.hospital());

  /** Today across every doctor, earliest first. */
  protected readonly clinic = lazyState(() =>
    this.appointments.list({ date: this.today, limit: 100, sort: 'time' }),
  );

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  /** Booked for today but nobody has checked them in yet. */
  protected readonly notArrived = computed(() =>
    (this.clinic.data()?.items ?? [])
      .filter((row) => row.status === 'confirmed' && !row.token)
      .slice(0, 8),
  );

  /** Currently in the building: checked in, called, or with a doctor. */
  protected readonly inBuilding = computed(() =>
    (this.clinic.data()?.items ?? []).filter(
      (row) => row.queueStatus === 'waiting' || row.queueStatus === 'called' || row.queueStatus === 'in-consultation',
    ),
  );

  /** Unpaid bookings — the desk's job to chase before the visit. */
  protected readonly unpaid = computed(() =>
    (this.clinic.data()?.items ?? []).filter((row) => row.paymentStatus === 'pending').slice(0, 6),
  );

  constructor() {
    void this.dashboard.load();
    void this.clinic.load();
  }

  protected reload(): void {
    void this.dashboard.load();
    void this.clinic.load();
  }
}
