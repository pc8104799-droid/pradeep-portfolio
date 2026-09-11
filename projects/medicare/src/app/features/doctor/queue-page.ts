import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ActionState,
  AppointmentService,
  lazyState,
  ToastService,
  type Appointment,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { ConfirmService } from '../../shared/ui/dialogs';
import { MC_PIPES } from '../../shared/pipes';

/**
 * Today's clinic.
 *
 * The working screen of the doctor panel: a token list ordered the way patients
 * are actually called, with the four things a doctor does to it — call, start,
 * complete, mark absent. Every action is a server transition, so the patient's
 * own screen updates from the same source of truth.
 */
@Component({
  selector: 'mc-queue-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './queue-page.html',
  styleUrl: './queue-page.scss',
})
export class QueuePage {
  private readonly appointments = inject(AppointmentService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly action = new ActionState();
  protected readonly date = signal(new Date().toISOString().slice(0, 10));

  protected readonly board = lazyState(() => this.appointments.queue(this.date()));

  protected readonly isToday = computed(() => this.date() === new Date().toISOString().slice(0, 10));

  /** The patient currently in the room, if any. */
  protected readonly active = computed(
    () => this.board.data()?.items.find((row) => row.queueStatus === 'in-consultation') ?? null,
  );

  /** Everyone still to be seen, in call order. */
  protected readonly waiting = computed(() =>
    (this.board.data()?.items ?? []).filter(
      (row) => row.queueStatus === 'waiting' || row.queueStatus === 'called',
    ),
  );

  protected readonly done = computed(() =>
    (this.board.data()?.items ?? []).filter(
      (row) => row.status === 'completed' || row.queueStatus === 'no-show',
    ),
  );

  /** Booked for today but not yet at reception. */
  protected readonly notArrived = computed(() =>
    (this.board.data()?.items ?? []).filter((row) => row.status === 'confirmed' && !row.token),
  );

  constructor() {
    void this.board.load();
  }

  protected setDate(date: string): void {
    this.date.set(date);
    void this.board.load();
  }

  protected async call(appointment: Appointment): Promise<void> {
    const updated = await this.action.run(() => this.appointments.queueAction(appointment.id, 'call'));
    if (!updated) return;

    this.toasts.info(`Token ${appointment.token} called`, `${appointment.patientName} has been notified.`);
    void this.board.load();
  }

  protected async start(appointment: Appointment): Promise<void> {
    // Opening the consultation is what moves the appointment into
    // `in-consultation`, so the navigation is the action.
    await this.router.navigate(['/doctor/consultation', appointment.id]);
  }

  protected async complete(appointment: Appointment): Promise<void> {
    const updated = await this.action.run(() =>
      this.appointments.queueAction(appointment.id, 'complete'),
    );
    if (!updated) return;

    this.toasts.success(`${appointment.patientName} marked complete`);
    void this.board.load();
  }

  protected async noShow(appointment: Appointment): Promise<void> {
    const agreed = await this.confirm.ask({
      heading: `Mark ${appointment.patientName} as a no-show?`,
      body: 'The slot is released and the visit is recorded as not attended.',
      confirmLabel: 'Mark no-show',
      tone: 'danger',
    });

    if (!agreed) return;

    const updated = await this.action.run(() =>
      this.appointments.queueAction(appointment.id, 'no-show'),
    );
    if (!updated) return;

    this.toasts.info('Marked as a no-show');
    void this.board.load();
  }

  protected async reset(appointment: Appointment): Promise<void> {
    const updated = await this.action.run(() => this.appointments.queueAction(appointment.id, 'reset'));
    if (!updated) return;

    this.toasts.info('Returned to the waiting list');
    void this.board.load();
  }

  /** Reception can check a patient in from here if they arrive at the door. */
  protected async checkIn(appointment: Appointment): Promise<void> {
    const updated = await this.action.run(() => this.appointments.checkIn(appointment.id));
    if (!updated) {
      this.toasts.error('Could not check in', this.action.error()?.message);
      return;
    }

    this.toasts.success(`Token ${updated.token} assigned`, appointment.patientName);
    void this.board.load();
  }
}
