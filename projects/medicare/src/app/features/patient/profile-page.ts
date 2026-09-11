import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  BLOOD_GROUPS,
  CatalogService,
  lazyState,
  PatientService,
  ToastService,
  type Patient,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { FieldError } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

const SECTIONS = [
  { id: 'personal', label: 'Personal' },
  { id: 'contact', label: 'Contact & address' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'medical', label: 'Medical & insurance' },
] as const;

/**
 * The patient's own record, editable.
 *
 * The same fields registration collected, grouped the same way, so nothing has
 * to be learned twice. Date of birth is deliberately read-only: it is what the
 * minor rule, the age and the whole clinical record hang off, and changing it
 * belongs at a reception desk with proof of identity, not in a self-service form.
 */
@Component({
  selector: 'mc-patient-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, DataState, QrCode, FieldError, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class PatientProfilePage {
  private readonly patients = inject(PatientService);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly catalog = inject(CatalogService);
  protected readonly sections = SECTIONS;
  protected readonly section = signal<(typeof SECTIONS)[number]['id']>('personal');
  protected readonly bloodGroups = BLOOD_GROUPS;
  protected readonly action = new ActionState();

  private readonly patientId = this.auth.profileId() ?? '';

  protected readonly profile = lazyState(() => this.patients.get(this.patientId));

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    middleName: [''],
    lastName: ['', [Validators.required]],
    gender: [''],
    bloodGroup: ['unknown'],
    maritalStatus: [''],
    occupation: [''],

    mobile: ['', [Validators.required, Validators.pattern(/^[+0-9 ()-]{10,18}$/)]],
    email: ['', [Validators.required, Validators.email]],
    address: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    country: ['India'],
    pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    preferredBranchId: [''],

    emergencyContactName: ['', [Validators.required]],
    emergencyContact: ['', [Validators.required]],
    emergencyContactRelationship: ['', [Validators.required]],
    guardianName: [''],
    guardianMobile: [''],
    guardianRelationship: [''],

    conditions: [''],
    allergies: [''],
    previousHospital: [''],
    insuranceProvider: [''],
    insuranceNumber: [''],
  });

  constructor() {
    void this.catalog.loadReference().catch(() => undefined);

    void this.profile.load().then((patient) => {
      if (patient) this.fill(patient);
    });
  }

  protected control(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  protected serverError(name: string): string {
    return this.action.fieldErrors()[name] ?? '';
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toasts.error('Some fields need attention', 'Check the highlighted boxes.');
      return;
    }

    const raw = this.form.getRawValue();
    const saved = await this.action.run(() =>
      this.patients.update(this.patientId, {
        ...raw,
        conditions: splitList(raw.conditions),
        allergies: splitList(raw.allergies),
      }),
    );

    if (!saved) return;

    this.profile.set(saved);
    this.auth.updateProfile(saved);
    this.form.markAsPristine();
    this.toasts.success('Profile updated', 'Your record has been saved.');
  }

  protected reset(): void {
    const patient = this.profile.data();
    if (patient) this.fill(patient);

    this.action.clear();
    this.form.markAsPristine();
  }

  private fill(patient: Patient): void {
    this.form.patchValue({
      firstName: patient.firstName,
      middleName: patient.middleName ?? '',
      lastName: patient.lastName,
      gender: patient.gender,
      bloodGroup: patient.bloodGroup,
      maritalStatus: patient.maritalStatus ?? '',
      occupation: patient.occupation ?? '',

      mobile: patient.mobile,
      email: patient.email,
      address: patient.address,
      city: patient.city,
      state: patient.state,
      country: patient.country,
      pincode: patient.pincode,
      preferredBranchId: patient.preferredBranchId,

      emergencyContactName: patient.emergencyContactName,
      emergencyContact: patient.emergencyContact,
      emergencyContactRelationship: patient.emergencyContactRelationship,
      guardianName: patient.guardianName ?? '',
      guardianMobile: patient.guardianMobile ?? '',
      guardianRelationship: patient.guardianRelationship ?? '',

      conditions: patient.conditions.join(', '),
      allergies: patient.allergies.join(', '),
      previousHospital: patient.previousHospital ?? '',
      insuranceProvider: patient.insuranceProvider ?? '',
      insuranceNumber: patient.insuranceNumber ?? '',
    });

    this.form.markAsPristine();
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
