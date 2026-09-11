import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AppointmentService,
  ClinicalService,
  PatientService,
  trackedState,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

/**
 * A patient, as their doctor sees them.
 *
 * The clinical picture and nothing else: history, prescriptions, reports and
 * visits with this doctor. Address, insurance number and occupation are
 * stripped by the API before the record leaves the server — a doctor treating
 * someone does not need their policy number.
 */
@Component({
  selector: 'mc-doctor-patient-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, QrCode, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './patient-detail-page.html',
  styleUrl: './patient-detail-page.scss',
})
export class DoctorPatientDetailPage {
  readonly patientId = input.required<string>();

  private readonly patients = inject(PatientService);
  private readonly clinical = inject(ClinicalService);
  private readonly appointments = inject(AppointmentService);

  protected readonly patient = trackedState(
    () => this.patientId(),
    () => this.patients.get(this.patientId()),
  );

  protected readonly timeline = trackedState(
    () => this.patientId(),
    () => this.patients.timeline(this.patientId()),
  );

  /*
   * All four panels are keyed off the route input rather than loaded in the
   * constructor: a required `input()` cannot be read while fields are still
   * initialising, and keying them this way also reloads every panel when the
   * doctor moves from one patient to the next.
   */
  protected readonly prescriptions = trackedState(
    () => this.patientId(),
    () => this.clinical.prescriptions({ patientId: this.patientId(), limit: 10, sort: '-issuedAt' }),
  );

  protected readonly reports = trackedState(
    () => this.patientId(),
    () => this.clinical.reports({ patientId: this.patientId(), limit: 10, sort: '-reportedOn' }),
  );

  protected readonly visits = trackedState(
    () => this.patientId(),
    () => this.appointments.list({ patientId: this.patientId(), limit: 10, sort: '-date' }),
  );
}
