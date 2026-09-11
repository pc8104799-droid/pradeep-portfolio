import { inject, Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { ChartPoint, DoctorDashboard, PatientDashboard } from '../models/medicare.models';

/** What the reception desk sees: the day in front of them, not lifetime totals. */
export interface HospitalStats {
  readonly totals: {
    readonly patients: number;
    readonly doctors: number;
    readonly departments: number;
    readonly branches: number;
    readonly registeredThisMonth: number;
  };
  readonly today: {
    readonly expected: number;
    readonly checkedIn: number;
    readonly waiting: number;
    readonly inConsultation: number;
    readonly completed: number;
    readonly cancelled: number;
    readonly noShow: number;
    readonly notArrived: number;
    readonly doctorsOnDuty: number;
  };
  readonly money: {
    readonly revenueToday: number;
    readonly revenueMonth: number;
    readonly unpaidCount: number;
    readonly unpaidValue: number;
    readonly refundedMonth: number;
  };
  readonly pharmacy: {
    readonly openOrders: number;
    readonly lowStock: number;
    readonly outOfStock: number;
  };
  readonly charts: {
    readonly byDepartment: readonly ChartPoint[];
    readonly daily: readonly ChartPoint[];
    readonly revenue: readonly ChartPoint[];
  };
  readonly onLeave: number;
}

/** What the pharmacy counter sees: the dispensing queue and the shelves. */
export interface PharmacyStats {
  readonly queue: {
    readonly placed: number;
    readonly confirmed: number;
    readonly preparing: number;
    readonly readyForPickup: number;
    readonly outForDelivery: number;
    readonly deliveredToday: number;
    readonly awaitingPayment: number;
    readonly needsPrescription: number;
  };
  readonly inventory: {
    readonly lines: number;
    readonly outOfStock: number;
    readonly lowStock: number;
    readonly expiringSoon: number;
    readonly stockValue: number;
  };
  readonly money: {
    readonly revenueToday: number;
    readonly revenueMonth: number;
  };
  readonly charts: {
    readonly revenue: readonly ChartPoint[];
    readonly byCategory: readonly ChartPoint[];
  };
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

  pharmacy(): Promise<PharmacyStats> {
    return this.api.get('/stats/pharmacy');
  }
}
