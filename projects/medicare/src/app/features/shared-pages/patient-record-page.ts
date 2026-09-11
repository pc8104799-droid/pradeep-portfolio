import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AppointmentService,
  AuthService,
  ClinicalService,
  PatientService,
  trackedState,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

/**
 * One patient's record, read by whoever is entitled to it.
 *
 * A doctor sees the clinical picture — history, prescriptions, reports, visits
 * — with the allergies at the top where they cannot be missed. Reception sees
 * the same plus the administrative half: contact details, address, insurance,
 * and the money owed.
 *
 * The difference is enforced by the API, which strips address, occupation and
 * insurance before a record reaches a doctor. This page only decides what to
 * *ask* for and how to lay it out; it is not the thing keeping the secret.
 */
@Component({
  selector: 'mc-patient-record',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, QrCode, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './patient-record-page.html',
  styleUrl: './patient-record-page.scss',
})
export class PatientRecordPage {
  readonly patientId = input.required<string>();

  private readonly patients = inject(PatientService);
  private readonly clinical = inject(ClinicalService);
  private readonly appointments = inject(AppointmentService);

  protected readonly auth = inject(AuthService);

  /** The subtree this page is mounted in, and so the prefix for its links. */
  protected readonly panel = computed(() => this.auth.panel());
  protected readonly isReception = computed(() => this.panel() === 'admin');

  /*
   * Every panel is keyed off the route input rather than loaded in the
   * constructor: a required `input()` cannot be read while fields are still
   * initialising, and keying them this way also reloads everything when the
   * user moves from one patient to the next.
   */
  protected readonly patient = trackedState(
    () => this.patientId(),
    () => this.patients.get(this.patientId()),
  );

  protected readonly timeline = trackedState(
    () => this.patientId(),
    () => this.patients.timeline(this.patientId()),
  );

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

  /** Reception can book on a patient's behalf; a doctor cannot. */
  protected readonly bookLink = computed(() =>
    this.isReception() ? ['/admin/appointments'] : null,
  );
}
