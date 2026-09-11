import { inject, Injectable, signal } from '@angular/core';
import { ApiService, type QueryInput } from '../api/api.service';
import type {
  Coupon,
  Department,
  Doctor,
  HospitalBranch,
  Medicine,
  MedicineCategory,
  Page,
  SlotDay,
  SlotSummaryDay,
} from '../models/medicare.models';

/** Everything the doctor-search screen can narrow by. */
export interface DoctorQuery extends QueryInput {
  q?: string;
  departmentId?: string;
  gender?: string;
  languages?: string;
  minExperience?: number;
  maxFee?: number;
  branchId?: string;
  availableOn?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface MedicineQuery extends QueryInput {
  q?: string;
  category?: string;
  form?: string;
  manufacturer?: string;
  maxPrice?: number;
  inStock?: boolean;
  prescriptionRequired?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

/**
 * Reference data: branches, departments, the doctor directory and the medicine
 * catalogue.
 *
 * Branches and departments are cached after the first read — they change about
 * once a year and are needed by nearly every filter bar, so refetching them per
 * screen would be noise. Anything that moves (doctors, slots, stock) is always
 * read fresh.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiService);

  private readonly _branches = signal<readonly HospitalBranch[]>([]);
  private readonly _departments = signal<readonly Department[]>([]);
  private readonly _medicineCategories = signal<readonly MedicineCategory[]>([]);

  readonly branches = this._branches.asReadonly();
  readonly departments = this._departments.asReadonly();
  readonly medicineCategories = this._medicineCategories.asReadonly();

  private reference: Promise<void> | null = null;

  /**
   * Loads the slow-moving lists once. Concurrent callers share the same
   * in-flight promise rather than each firing their own request.
   */
  loadReference(): Promise<void> {
    this.reference ??= (async () => {
      const [branches, departments, categories] = await Promise.all([
        this.api.get<{ items: HospitalBranch[] }>('/branches'),
        this.api.get<Page<Department>>('/departments'),
        this.api.get<{ items: MedicineCategory[] }>('/medicine-categories'),
      ]);

      this._branches.set(branches.items);
      this._departments.set(departments.items);
      this._medicineCategories.set(categories.items);
    })().catch((error) => {
      // Let the next caller try again rather than caching a failure forever.
      this.reference = null;
      throw error;
    });

    return this.reference;
  }

  department(id: string): Department | undefined {
    return this._departments().find((row) => row.id === id);
  }

  branch(id: string): HospitalBranch | undefined {
    return this._branches().find((row) => row.id === id);
  }

  departmentsPage(query?: QueryInput): Promise<Page<Department>> {
    return this.api.get('/departments', query);
  }

  departmentDetail(id: string): Promise<Department> {
    return this.api.get(`/departments/${id}`);
  }

  doctors(query?: DoctorQuery): Promise<Page<Doctor>> {
    return this.api.get('/doctors', query);
  }

  doctor(id: string): Promise<Doctor> {
    return this.api.get(`/doctors/${id}`);
  }

  /** One day's slots for the booking wizard's time picker. */
  slots(doctorId: string, date: string): Promise<SlotDay> {
    return this.api.get(`/doctors/${doctorId}/slots`, { date });
  }

  /** Slot counts per day, for the date strip above the time picker. */
  slotSummary(doctorId: string, days = 14): Promise<{ items: SlotSummaryDay[] }> {
    return this.api.get(`/doctors/${doctorId}/slot-summary`, { days });
  }

  medicines(query?: MedicineQuery): Promise<Page<Medicine>> {
    return this.api.get('/medicines', query);
  }

  medicine(id: string): Promise<Medicine> {
    return this.api.get(`/medicines/${id}`);
  }

  coupons(appliesTo: 'pharmacy' | 'consultation'): Promise<{ items: Coupon[] }> {
    return this.api.get('/coupons', { appliesTo });
  }
}
