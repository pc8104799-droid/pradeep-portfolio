import { inject, Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { Doctor, DoctorAvailability, DoctorLeave, Appointment } from '../models/medicare.models';

/**
 * The doctor's own settings: published hours, leave, and the parts of their
 * profile they are allowed to edit.
 *
 * Fee, department and registration number are not here on purpose — those are
 * hospital administration, and the API rejects them from this endpoint.
 */
@Injectable({ providedIn: 'root' })
export class DoctorService {
  private readonly api = inject(ApiService);

  availability(doctorId: string): Promise<DoctorAvailability> {
    return this.api.get(`/doctors/${doctorId}/availability`);
  }

  /** Saving hours immediately changes what patients can book. */
  saveAvailability(doctorId: string, availability: DoctorAvailability): Promise<DoctorAvailability> {
    return this.api.put(`/doctors/${doctorId}/availability`, {
      slotMinutes: availability.slotMinutes,
      maxPerSlot: availability.maxPerSlot,
      breakStart: availability.breakStart ?? '',
      breakEnd: availability.breakEnd ?? '',
      schedule: availability.schedule,
    });
  }

  leaves(doctorId: string): Promise<{ items: DoctorLeave[] }> {
    return this.api.get(`/doctors/${doctorId}/leaves`);
  }

  /**
   * Books leave. Appointments already on the books during those dates come
   * back as `clashes` rather than being cancelled — the doctor decides what
   * happens to each one.
   */
  addLeave(
    doctorId: string,
    leave: { from: string; to: string; reason: string },
  ): Promise<{ leave: DoctorLeave; clashes: Appointment[] }> {
    return this.api.post(`/doctors/${doctorId}/leaves`, leave);
  }

  removeLeave(doctorId: string, leaveId: string): Promise<{ ok: boolean }> {
    return this.api.delete(`/doctors/${doctorId}/leaves/${leaveId}`);
  }

  updateProfile(
    doctorId: string,
    patch: { phone?: string; languages?: readonly string[]; about?: string; acceptsOnline?: boolean },
  ): Promise<Doctor> {
    return this.api.patch(`/doctors/${doctorId}`, patch);
  }
}
