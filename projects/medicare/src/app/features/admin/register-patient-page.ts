import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  BLOOD_GROUPS,
  CatalogService,
  PatientService,
  ToastService,
  type Patient,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { FieldError } from '../../shared/ui/controls';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

/**
 * Walk-in registration at the counter.
 *
 * Shorter than the patient's own sign-up form on purpose: someone is standing
 * at a desk, so this collects what is needed to treat and bill them and nothing
 * else. The rest — marital status, occupation, medical history — the patient
 * fills in later from their own profile.
 *
 * The account is created with a temporary password, which the server returns
 * exactly once. That is why the success panel is the important part of this
 * screen: it is the only chance to hand the credentials over.
 */
@Component({
  selector: 'mc-register-patient',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, QrCode, FieldError, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './register-patient-page.html',
  styleUrl: './register-patient-page.scss',
})
export class RegisterPatientPage {
  private readonly patients = inject(PatientService);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly catalog = inject(CatalogService);
  protected readonly bloodGroups = BLOOD_GROUPS;
  protected readonly action = new ActionState();
  protected readonly today = new Date().toISOString().slice(0, 10);

  /** Set once the record exists — this is the handover screen. */
  protected readonly created = signal<{ patient: Patient; temporaryPassword: string } | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    middleName: [''],
    lastName: ['', [Validators.required]],
    dateOfBirth: ['', [Validators.required, notInFuture]],
    gender: ['', [Validators.required]],
    bloodGroup: ['unknown'],

    mobile: ['', [Validators.required, Validators.pattern(/^[+0-9 ()-]{10,18}$/)]],
    email: ['', [Validators.required, Validators.email]],
    address: [''],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    pincode: ['', [Validators.pattern(/^\d{6}$/)]],

    emergencyContactName: ['', [Validators.required]],
    emergencyContact: ['', [Validators.required, Validators.pattern(/^[+0-9 ()-]{10,18}$/)]],
    emergencyContactRelationship: ['', [Validators.required]],

    guardianName: [''],
    guardianMobile: [''],
    guardianRelationship: [''],

    allergies: [''],
    conditions: [''],
    insuranceProvider: [''],
    insuranceNumber: [''],
    preferredBranchId: [this.auth.profileId() ?? 'BR-000001'],
  });

  /** Age is derived, so it can never contradict the date of birth. */
  protected readonly age = computed(() => {
    const dob = this.dob();
    if (!dob) return null;

    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const before =
      now.getMonth() < dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());

    return Math.max(0, before ? years - 1 : years);
  });

  protected readonly isMinor = computed(() => {
    const age = this.age();
    return age !== null && age < 18;
  });

  private readonly dob = signal<Date | null>(null);

  constructor() {
    void this.catalog.loadReference().catch(() => undefined);

    this.form.controls.dateOfBirth.valueChanges.subscribe((value) => {
      const parsed = value ? new Date(`${value}T00:00:00`) : null;
      this.dob.set(parsed && !Number.isNaN(parsed.getTime()) ? parsed : null);
    });
  }

  protected control(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  protected serverError(name: string): string {
    return this.action.fieldErrors()[name] ?? '';
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toasts.error('Some fields need attention', 'Check the highlighted boxes.');
      return;
    }

    if (this.isMinor() && !this.form.controls.guardianName.value) {
      this.form.controls.guardianName.setErrors({ guardian: true });
      this.form.controls.guardianName.markAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const result = await this.action.run(() =>
      this.patients.register({
        ...raw,
        allergies: splitList(raw.allergies),
        conditions: splitList(raw.conditions),
      }),
    );

    if (!result) return;

    this.created.set(result);
    this.toasts.success(
      `${result.patient.name} registered`,
      `Patient ID ${result.patient.id}`,
    );
  }

  /** Clears the form for the next person in the queue. */
  protected registerAnother(): void {
    this.created.set(null);
    this.action.clear();
    this.form.reset({
      bloodGroup: 'unknown',
      preferredBranchId: this.auth.profileId() ?? 'BR-000001',
    });
  }

  protected print(): void {
    window.print();
  }
}

function notInFuture(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return control.value > new Date().toISOString().slice(0, 10) ? { future: true } : null;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
