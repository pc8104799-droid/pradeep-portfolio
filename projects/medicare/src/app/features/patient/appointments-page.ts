import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AppointmentService,
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
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * The patient's appointment list.
 *
 * Rows carry their own actions, because the useful thing to do with an
 * appointment depends entirely on its state: an unpaid one needs paying, a
 * confirmed one today needs checking in, a future one can be moved or
 * cancelled, and a finished one is a link into the record it produced.
 */
@Component({
  selector: 'mc-appointments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  templateUrl: './appointments-page.html',
  styleUrl: './appointments-page.scss',
})
export class AppointmentsPage {
  private readonly appointments = inject(AppointmentService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly tabs = TABS;
  protected readonly tab = signal<TabId>('upcoming');
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly action = new ActionState();
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly list = lazyState(() => this.appointments.list(this.query()));

  constructor() {
    void this.list.load();
  }

  private query(): AppointmentQuery {
    const tab = this.tab();

    return {
      q: this.search(),
      upcoming: tab === 'upcoming' || undefined,
      past: tab === 'past' || undefined,
      sort: tab === 'upcoming' ? 'date' : '-date',
      page: this.page(),
      limit: 10,
    };
  }

  protected setTab(tab: TabId): void {
    this.tab.set(tab);
    this.page.set(1);
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

  /** Whether this booking still needs paying before it is confirmed. */
  protected needsPayment(appointment: Appointment): boolean {
    return appointment.status === 'pending' && appointment.paymentStatus !== 'successful';
  }

  protected canCheckIn(appointment: Appointment): boolean {
    return appointment.status === 'confirmed' && appointment.date === this.today;
  }

  protected canCancel(appointment: Appointment): boolean {
    return ['pending', 'confirmed', 'rescheduled'].includes(appointment.status);
  }

  protected async checkIn(appointment: Appointment): Promise<void> {
    const updated = await this.action.run(() => this.appointments.checkIn(appointment.id));
    if (!updated) {
      this.toasts.error('Could not check in', this.action.error()?.message);
      return;
    }

    this.toasts.success(`Checked in — token ${updated.token}`, 'The doctor can see you in the queue.');
    void this.list.load();
  }

  protected async cancel(appointment: Appointment): Promise<void> {
    const agreed = await this.confirm.ask({
      heading: 'Cancel this appointment?',
      body:
        appointment.paymentStatus === 'successful'
          ? `Your visit with ${appointment.doctorName} on ${appointment.date} will be cancelled and a refund raised.`
          : `Your visit with ${appointment.doctorName} on ${appointment.date} will be cancelled.`,
      confirmLabel: 'Cancel appointment',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });

    if (!agreed) return;

    const updated = await this.action.run(() => this.appointments.cancel(appointment.id));
    if (!updated) {
      this.toasts.error('Could not cancel', this.action.error()?.message);
      return;
    }

    this.toasts.success(
      'Appointment cancelled',
      updated.paymentStatus === 'refunded' ? 'A refund has been raised.' : undefined,
    );
    void this.list.load();
  }

  protected readonly emptyCopy = computed(() =>
    this.tab() === 'upcoming'
      ? {
          title: 'No upcoming appointments',
          body: 'Search by department, compare fees and availability, and book a slot.',
        }
      : this.tab() === 'past'
        ? { title: 'No past visits yet', body: 'Completed consultations appear here with their records.' }
        : { title: 'Nothing booked yet', body: 'Your appointments will be listed here.' },
  );
}
