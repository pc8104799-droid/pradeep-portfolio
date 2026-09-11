import { inject, Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { DoctorDashboard, PatientDashboard } from '../models/medicare.models';

export interface HospitalStats {
  readonly patients: number;
  readonly doctors: number;
  readonly departments: number;
  readonly appointmentsToday: number;
  readonly revenueToday: number;
  readonly pendingOrders: number;
  readonly lowStock: number;
  readonly outOfStock: number;
}

/**
 * Dashboard aggregates.
 *
 * The arithmetic lives on the server, so a dashboard is one request instead of
 * six lists the browser would have to count — and the numbers on a doctor's
 * screen match the numbers in the hospital's own reporting.
 */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly api = inject(ApiService);

  doctor(doctorId: string): Promise<DoctorDashboard> {
    return this.api.get(`/stats/doctor/${doctorId}`);
  }

  patient(patientId: string): Promise<PatientDashboard> {
    return this.api.get(`/stats/patient/${patientId}`);
  }

  hospital(): Promise<HospitalStats> {
    return this.api.get('/stats/hospital');
  }
}
