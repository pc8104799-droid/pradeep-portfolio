import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ActionState,
  AppointmentService,
  AuthService,
  CatalogService,
  lazyState,
  ToastService,
  trackedState,
  type Appointment,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { ConfirmService, Modal } from '../../shared/ui/dialogs';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

/**
 * One appointment, from either side.
 *
 * The same record means different things to the two roles, so the page keeps
 * one body and swaps the actions: a patient pays, checks in, reschedules or
 * cancels; a doctor starts the consultation and opens the patient's history.
 * Splitting this into two near-identical pages would mean fixing every layout
 * bug twice.
 */
@Component({
  selector: 'mc-appointment-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, Modal, QrCode, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './appointment-detail-page.html',
  styleUrl: './appointment-detail-page.scss',
})
export class AppointmentDetailPage {
  readonly appointmentId = input.required<string>();

  private readonly appointments = inject(AppointmentService);
  private readonly catalog = inject(CatalogService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly auth = inject(AuthService);
  protected readonly action = new ActionState();
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly panel = computed(() => (this.auth.role() === 'doctor' ? 'doctor' : 'patient'));

  protected readonly appointment = trackedState(
    () => this.appointmentId(),
    () => this.appointments.get(this.appointmentId()),
  );

  /* ------------------------------------------------------ rescheduling */

  protected readonly rescheduleOpen = signal(false);
  protected readonly newDate = signal('');
  protected readonly newTime = signal('');

  protected readonly slots = lazyState(() =>
    this.catalog.slots(this.appointment.data()?.doctorId ?? '', this.newDate()),
  );

  /* ---------------------------------------------------------- derived */

  protected readonly isPatientView = computed(() => this.panel() === 'patient');

  protected readonly canPay = computed(() => {
    const appointment = this.appointment.data();
    return (
      this.isPatientView() &&
      !!appointment &&
      appointment.status === 'pending' &&
      appointment.paymentStatus !== 'successful'
    );
  });

  protected readonly canCheckIn = computed(() => {
    const appointment = this.appointment.data();
    return !!appointment && appointment.status === 'confirmed' && appointment.date === this.today;
  });

  protected readonly canModify = computed(() => {
    const appointment = this.appointment.data();
    return !!appointment && ['pending', 'confirmed', 'rescheduled'].includes(appointment.status);
  });

  protected readonly canConsult = computed(() => {
    const appointment = this.appointment.data();
    return (
      this.panel() === 'doctor' &&
      !!appointment &&
      ['confirmed', 'checked-in', 'in-consultation'].includes(appointment.status)
    );
  });

  /* ---------------------------------------------------------- actions */

  protected openReschedule(): void {
    const appointment = this.appointment.data();
    if (!appointment) return;

    this.newDate.set(appointment.date);
    this.newTime.set('');
    this.rescheduleOpen.set(true);

    void this.slots.load();
  }

  protected pickDate(date: string): void {
    this.newDate.set(date);
    this.newTime.set('');
    void this.slots.load();
  }

  protected async reschedule(): Promise<void> {
    const appointment = this.appointment.data();
    if (!appointment || !this.newTime()) return;

    const updated = await this.action.run(() =>
      this.appointments.reschedule(appointment.id, this.newDate(), this.newTime()),
    );

    if (!updated) {
      this.toasts.error('Could not reschedule', this.action.error()?.message);
      return;
    }

    this.rescheduleOpen.set(false);
    this.toasts.success('Appointment moved', `${updated.date} at ${updated.time}`);
    void this.appointment.load();
  }

  protected async checkIn(): Promise<void> {
    const appointment = this.appointment.data();
    if (!appointment) return;

    const updated = await this.action.run(() => this.appointments.checkIn(appointment.id));
    if (!updated) {
      this.toasts.error('Could not check in', this.action.error()?.message);
      return;
    }

    this.toasts.success(`Checked in — token ${updated.token}`, 'You are in the queue.');
    void this.appointment.load();
  }

  protected async cancel(): Promise<void> {
    const appointment = this.appointment.data();
    if (!appointment) return;

    const agreed = await this.confirm.ask({
      heading: 'Cancel this appointment?',
      body:
        appointment.paymentStatus === 'successful'
          ? 'The booking will be cancelled and a refund raised against the payment.'
          : 'The booking will be cancelled and the slot released.',
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

    this.toasts.success('Appointment cancelled');
    void this.appointment.load();
  }

  protected async startConsultation(): Promise<void> {
    const appointment = this.appointment.data();
    if (!appointment) return;

    await this.router.navigate(['/doctor/consultation', appointment.id]);
  }

  /** The two-week strip the reschedule dialog offers. */
  protected nextDates(): string[] {
    const today = new Date();

    return Array.from({ length: 14 }, (_value, offset) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      return date.toISOString().slice(0, 10);
    });
  }

  protected statusNote(appointment: Appointment): string {
    switch (appointment.status) {
      case 'pending':
        return 'This slot is held but not confirmed. It is released if the fee is not paid.';
      case 'confirmed':
        return 'Confirmed. Arrive ten minutes early and check in at reception.';
      case 'checked-in':
        return 'Checked in. The doctor will call your token.';
      case 'in-consultation':
        return 'The consultation is in progress.';
      case 'completed':
        return 'This visit is finished. The record and prescription are below.';
      case 'cancelled':
        return 'This appointment was cancelled.';
      case 'no-show':
        return 'Marked as a no-show by the clinic.';
      default:
        return '';
    }
  }
}
