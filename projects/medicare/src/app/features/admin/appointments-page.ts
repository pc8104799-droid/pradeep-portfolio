import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ActionState,
  AppointmentService,
  CatalogService,
  lazyState,
  ToastService,
  type Appointment,
  type AppointmentQuery,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { ConfirmService } from '../../shared/ui/dialogs';
import { MC_PIPES } from '../../shared/pipes';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const STATUSES = [
  '',
  'pending',
  'confirmed',
  'checked-in',
  'in-consultation',
  'completed',
  'cancelled',
  'no-show',
];

/**
 * The hospital's appointment book, from the front desk.
 *
 * Unlike the doctor's list this spans every consultant, so it filters by
 * department and doctor as well as by status — reception is asked "who is
 * seeing Dr Rao this afternoon", not "what is my day".
 *
 * Check-in lives on the row because that is the single most common thing that
 * happens at a reception counter, and making it a two-click detour would be a
 * design failure rather than a detail.
 */
@Component({
  selector: 'mc-admin-appointments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  templateUrl: './appointments-page.html',
  styleUrl: './appointments-page.scss',
})
export class AdminAppointmentsPage {
  private readonly appointments = inject(AppointmentService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);

  protected readonly catalog = inject(CatalogService);
  protected readonly tabs = TABS;
  protected readonly statuses = STATUSES;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly tab = signal<TabId>('today');
  protected readonly status = signal('');
  protected readonly departmentId = signal('');
  protected readonly search = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  protected readonly page = signal(1);
  protected readonly action = new ActionState();

  protected readonly list = lazyState(() => this.appointments.list(this.query()));

  protected readonly counts = computed(() => {
    const rows = this.list.data()?.items ?? [];

    return {
      unpaid: rows.filter((row) => row.paymentStatus === 'pending').length,
      waiting: rows.filter((row) => row.queueStatus === 'waiting').length,
      notArrived: rows.filter((row) => row.status === 'confirmed' && !row.token).length,
    };
  });

  constructor() {
    void this.catalog.loadReference().catch(() => undefined);

    // Arriving from a patient record pre-filters to that patient.
    void this.list.load();
  }

  private query(): AppointmentQuery {
    const tab = this.tab();

    return {
      q: this.search(),
      status: this.status(),
      departmentId: this.departmentId(),
      date: tab === 'today' ? this.today : undefined,
      upcoming: tab === 'upcoming' || undefined,
      past: tab === 'past' || undefined,
      sort: tab === 'past' ? '-date' : tab === 'today' ? 'time' : 'date',
      page: this.page(),
      limit: 15,
    };
  }

  protected patch(change: Partial<{ tab: TabId; status: string; departmentId: string; search: string; page: number }>): void {
    if (change.tab !== undefined) this.tab.set(change.tab);
    if (change.status !== undefined) this.status.set(change.status);
    if (change.departmentId !== undefined) this.departmentId.set(change.departmentId);
    if (change.search !== undefined) this.search.set(change.search);

    this.page.set(change.page ?? 1);
    void this.list.load();
  }

  protected canCheckIn(appointment: Appointment): boolean {
    return appointment.status === 'confirmed' && appointment.date === this.today;
  }

  protected async checkIn(appointment: Appointment): Promise<void> {
    const updated = await this.action.run(() => this.appointments.checkIn(appointment.id));
    if (!updated) {
      this.toasts.error('Could not check in', this.action.error()?.message);
      return;
    }

    this.toasts.success(
      `Token ${updated.token} — ${appointment.patientName}`,
      `${appointment.doctorName} has been notified.`,
    );
    void this.list.load();
  }

  protected async cancel(appointment: Appointment): Promise<void> {
    const agreed = await this.confirm.ask({
      heading: `Cancel ${appointment.patientName}'s appointment?`,
      body:
        appointment.paymentStatus === 'successful'
          ? `Their visit with ${appointment.doctorName} will be cancelled and a refund raised.`
          : `Their visit with ${appointment.doctorName} will be cancelled and the slot released.`,
      confirmLabel: 'Cancel appointment',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });

    if (!agreed) return;

    const updated = await this.action.run(() =>
      this.appointments.cancel(appointment.id, 'Cancelled at the reception desk.'),
    );

    if (!updated) {
      this.toasts.error('Could not cancel', this.action.error()?.message);
      return;
    }

    this.toasts.success('Appointment cancelled');
    void this.list.load();
  }
}
