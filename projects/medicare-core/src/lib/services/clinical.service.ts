import { inject, Injectable } from '@angular/core';
import { ApiService, type QueryInput } from '../api/api.service';
import type {
  Consultation,
  MedicalRecord,
  MedicalReport,
  Page,
  PrescribedMedicine,
  Prescription,
  TestCategory,
  TestRequest,
  TestStatus,
  Vitals,
} from '../models/medicare.models';

/** The fields a doctor fills in on the consultation screen. */
export interface ConsultationDraft {
  chiefComplaint?: string;
  symptoms?: readonly string[];
  examination?: string;
  vitals?: Vitals;
  diagnosis?: string;
  treatmentPlan?: string;
  notes?: string;
  followUpDate?: string | null;
  followUpReason?: string;
}

export interface PrescriptionDraft {
  readonly consultationId: string;
  readonly diagnosis: string;
  readonly medicines: readonly PrescribedMedicine[];
  readonly advice?: string;
  readonly followUpDate?: string | null;
  /** Set after the doctor confirms an allergy warning. */
  readonly acknowledgeAllergy?: boolean;
}

/**
 * The clinical record.
 *
 * The write side is the doctor's consultation flow — open, draft, prescribe,
 * request tests, complete. The read side is what the patient sees afterwards.
 * Both go through here so the two halves cannot drift apart.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalService {
  private readonly api = inject(ApiService);

  /* ---------------------------------------------------- consultations */

  /** Opens (or re-opens) the consultation for an appointment. Idempotent. */
  openConsultation(appointmentId: string): Promise<Consultation> {
    return this.api.post('/consultations', { appointmentId });
  }

  consultation(id: string): Promise<Consultation> {
    return this.api.get(`/consultations/${id}`);
  }

  /** Saves the draft. Called on each step of the consultation form. */
  saveConsultation(id: string, draft: ConsultationDraft): Promise<Consultation> {
    return this.api.patch(`/consultations/${id}`, draft);
  }

  /** Closes the visit, which is what writes the permanent medical record. */
  completeConsultation(id: string): Promise<{ consultation: Consultation; record: MedicalRecord }> {
    return this.api.post(`/consultations/${id}/complete`);
  }

  /* ---------------------------------------------------- prescriptions */

  prescriptions(query?: QueryInput): Promise<Page<Prescription>> {
    return this.api.get('/prescriptions', query);
  }

  prescription(id: string): Promise<Prescription> {
    return this.api.get(`/prescriptions/${id}`);
  }

  /** Creates or revises the prescription for a consultation. */
  savePrescription(draft: PrescriptionDraft): Promise<Prescription> {
    return this.api.post('/prescriptions', draft);
  }

  /* --------------------------------------------------------- records */

  records(query?: QueryInput): Promise<Page<MedicalRecord>> {
    return this.api.get('/medical-records', query);
  }

  record(id: string): Promise<MedicalRecord> {
    return this.api.get(`/medical-records/${id}`);
  }

  /* ------------------------------------------------ tests and reports */

  testRequests(query?: QueryInput): Promise<Page<TestRequest>> {
    return this.api.get('/test-requests', query);
  }

  requestTest(request: {
    consultationId: string;
    testName: string;
    category: TestCategory;
    priority?: 'routine' | 'urgent';
    clinicalReason: string;
    notes?: string;
  }): Promise<TestRequest> {
    return this.api.post('/test-requests', request);
  }

  updateTestStatus(id: string, status: TestStatus, notes?: string): Promise<TestRequest> {
    return this.api.patch(`/test-requests/${id}`, { status, notes });
  }

  reports(query?: QueryInput): Promise<Page<MedicalReport>> {
    return this.api.get('/medical-reports', query);
  }

  report(id: string): Promise<MedicalReport> {
    return this.api.get(`/medical-reports/${id}`);
  }

  /** A doctor's note on a released result; the patient is notified. */
  commentOnReport(id: string, doctorComments: string): Promise<MedicalReport> {
    return this.api.patch(`/medical-reports/${id}/comments`, { doctorComments });
  }
}
