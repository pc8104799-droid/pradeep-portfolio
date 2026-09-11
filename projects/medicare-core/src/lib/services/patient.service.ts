import { inject, Injectable } from '@angular/core';
import { ApiService, type QueryInput } from '../api/api.service';
import type {
  Address,
  EmergencyCard,
  FamilyMember,
  Page,
  Patient,
  PatientSummary,
  Timeline,
} from '../models/medicare.models';

/** Patient records, their family, their addresses and their history. */
@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly api = inject(ApiService);

  /** Staff-only directory. A patient calling this gets a 403. */
  list(query?: QueryInput): Promise<Page<Patient>> {
    return this.api.get('/patients', query);
  }

  get(patientId: string): Promise<Patient> {
    return this.api.get(`/patients/${patientId}`);
  }

  /**
   * The joined dashboard picture in one call — appointments, prescriptions,
   * reports, payments and family, already sorted.
   */
  summary(patientId: string): Promise<PatientSummary> {
    return this.api.get(`/patients/${patientId}/summary`);
  }

  /** The short list that matters in an emergency. */
  emergency(patientId: string): Promise<EmergencyCard> {
    return this.api.get(`/patients/${patientId}/emergency`);
  }

  /** Year-grouped history: visits, prescriptions, reports and what is next. */
  timeline(patientId: string): Promise<Timeline> {
    return this.api.get(`/patients/${patientId}/timeline`);
  }

  update(patientId: string, patch: Record<string, unknown>): Promise<Patient> {
    return this.api.patch(`/patients/${patientId}`, patch);
  }

  /* ------------------------------------------------------------ family */

  family(patientId: string): Promise<{ items: FamilyMember[] }> {
    return this.api.get(`/patients/${patientId}/family`);
  }

  addFamilyMember(patientId: string, member: Record<string, unknown>): Promise<FamilyMember> {
    return this.api.post(`/patients/${patientId}/family`, member);
  }

  updateFamilyMember(
    patientId: string,
    memberId: string,
    member: Record<string, unknown>,
  ): Promise<FamilyMember> {
    return this.api.patch(`/patients/${patientId}/family/${memberId}`, member);
  }

  removeFamilyMember(patientId: string, memberId: string): Promise<{ ok: boolean }> {
    return this.api.delete(`/patients/${patientId}/family/${memberId}`);
  }

  /* --------------------------------------------------------- addresses */

  addresses(patientId: string): Promise<{ items: Address[] }> {
    return this.api.get(`/patients/${patientId}/addresses`);
  }

  addAddress(patientId: string, address: Record<string, unknown>): Promise<Address> {
    return this.api.post(`/patients/${patientId}/addresses`, address);
  }

  removeAddress(patientId: string, addressId: string): Promise<{ ok: boolean }> {
    return this.api.delete(`/patients/${patientId}/addresses/${addressId}`);
  }
}
