import { inject, Injectable } from '@angular/core';
import { ApiService, type QueryInput } from '../api/api.service';
import type {
  Appointment,
  AppointmentStatus,
  Page,
  Payment,
  QueueBoard,
} from '../models/medicare.models';

export interface AppointmentQuery extends QueryInput {
  q?: string;
  status?: AppointmentStatus | string;
  departmentId?: string;
  doctorId?: string;
  patientId?: string;
  date?: string;
  from?: string;
  to?: string;
  upcoming?: boolean;
  past?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

/** What the booking wizard sends when it reaches the review step. */
export interface BookingRequest {
  readonly doctorId: string;
  readonly date: string;
  readonly time: string;
  readonly reason: string;
  readonly consultationType: 'in-person' | 'online';
  readonly symptoms?: readonly string[];
  readonly familyMemberId?: string | null;
  readonly couponCode?: string;
  readonly patientId?: string;
}

/**
 * Appointments, and the clinic queue they feed.
 *
 * Booking deliberately returns the payment alongside the appointment: a visit
 * is only confirmed once that payment settles, so the wizard always has the id
 * it needs for the next step without a second lookup.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly api = inject(ApiService);

  /** Scoped by the API to the signed-in patient or doctor. */
  list(query?: AppointmentQuery): Promise<Page<Appointment>> {
    return this.api.get('/appointments', query);
  }

  get(id: string): Promise<Appointment> {
    return this.api.get(`/appointments/${id}`);
  }

  book(request: BookingRequest): Promise<{ appointment: Appointment; payment: Payment }> {
    return this.api.post('/appointments', request);
  }

  reschedule(id: string, date: string, time: string): Promise<Appointment> {
    return this.api.patch(`/appointments/${id}/reschedule`, { date, time });
  }

  cancel(id: string, reason?: string): Promise<Appointment> {
    return this.api.post(`/appointments/${id}/cancel`, { reason });
  }

  /** Arriving at reception — this is what assigns the day's token. */
  checkIn(id: string): Promise<Appointment> {
    return this.api.post(`/appointments/${id}/check-in`);
  }

  /** Today's clinic, ordered the way patients are actually called. */
  queue(date?: string, doctorId?: string): Promise<QueueBoard> {
    return this.api.get('/appointments/queue/today', { date, doctorId });
  }

  /** Moves one patient through the queue. */
  queueAction(
    id: string,
    action: 'call' | 'start' | 'complete' | 'no-show' | 'reset',
  ): Promise<Appointment> {
    return this.api.post(`/appointments/${id}/queue`, { action });
  }
}
