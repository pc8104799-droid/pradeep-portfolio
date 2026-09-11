import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  BLOOD_GROUPS,
  CatalogService,
  ToastService,
} from '@pc/medicare-core';
import { FieldError, Stepper, type Step } from '../../shared/ui/controls';
import { AuthLayout } from './auth-layout';

/** The four steps, in the order a reception desk would actually ask. */
const STEPS: readonly Step[] = [
  { id: 'identity', label: 'About you' },
  { id: 'contact', label: 'Contact & address' },
  { id: 'emergency', label: 'Emergency contact' },
  { id: 'medical', label: 'Medical & account' },
];

/** Which controls belong to which step, so one step can be validated alone. */
const STEP_FIELDS: readonly (readonly string[])[] = [
  ['firstName', 'middleName', 'lastName', 'dateOfBirth', 'gender', 'bloodGroup', 'maritalStatus', 'occupation'],
  ['mobile', 'email', 'address', 'city', 'state', 'country', 'pincode', 'preferredBranchId'],
  [
    'emergencyContactName',
    'emergencyContact',
    'emergencyContactRelationship',
    'guardianName',
    'guardianMobile',
    'guardianRelationship',
  ],
  ['conditions', 'allergies', 'currentMedicines', 'previousHospital', 'insuranceProvider', 'insuranceNumber', 'password', 'confirmPassword', 'consent'],
];

/**
 * Patient registration.
 *
 * A hospital intake form is long — twenty-eight fields here — so it is split
 * into four steps that each fit on a phone screen without scrolling forever,
 * and each step is validated before the next one opens. That way a mistake is
 * caught next to the field that caused it rather than at the end.
 *
 * The one piece of real logic: a patient under eighteen cannot be their own
 * responsible adult, so the guardian block becomes mandatory the moment the date
 * of birth says so — and the server enforces the same rule independently.
 */
@Component({
  selector: 'mc-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FieldError, Stepper, AuthLayout],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly catalog = inject(CatalogService);
  protected readonly steps = STEPS;
  protected readonly bloodGroups = BLOOD_GROUPS;
  protected readonly action = new ActionState();
  protected readonly stepIndex = signal(0);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      middleName: [''],
      lastName: ['', [Validators.required]],
      dateOfBirth: ['', [Validators.required, notInFuture]],
      gender: ['', [Validators.required]],
      bloodGroup: ['unknown', [Validators.required]],
      maritalStatus: ['single'],
      occupation: [''],

      mobile: ['', [Validators.required, Validators.pattern(/^[+0-9 ()-]{10,18}$/)]],
      email: ['', [Validators.required, Validators.email]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      city: ['', [Validators.required]],
      state: ['', [Validators.required]],
      country: ['India', [Validators.required]],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      preferredBranchId: ['BR-000001'],

      emergencyContactName: ['', [Validators.required]],
      emergencyContact: ['', [Validators.required, Validators.pattern(/^[+0-9 ()-]{10,18}$/)]],
      emergencyContactRelationship: ['', [Validators.required]],
      guardianName: [''],
      guardianMobile: [''],
      guardianRelationship: [''],

      conditions: [''],
      allergies: [''],
      currentMedicines: [''],
      previousHospital: [''],
      insuranceProvider: [''],
      insuranceNumber: [''],

      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      consent: [false, [Validators.requiredTrue]],
    },
    { validators: [passwordsMatch, guardianRequiredForMinors] },
  );

  /** Age is derived, never typed — one less thing to contradict the DOB. */
  protected readonly age = computed(() => {
    const dob = this.dobSignal();
    if (!dob) return null;

    const birth = new Date(`${dob}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return null;

    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    const before =
      now.getMonth() < birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());

    return Math.max(0, before ? years - 1 : years);
  });

  protected readonly isMinor = computed(() => {
    const age = this.age();
    return age !== null && age < 18;
  });

  private readonly dobSignal = signal('');

  constructor() {
    void this.catalog.loadReference().catch(() => {
      // Branch choice degrades to the default; registration still works.
    });

    this.form.controls.dateOfBirth.valueChanges.subscribe((value) => this.dobSignal.set(value));
  }

  protected fields(index: number): readonly string[] {
    return STEP_FIELDS[index] ?? [];
  }

  protected control(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  protected invalid(name: string): boolean {
    const control = this.control(name);
    return control.invalid && (control.dirty || control.touched);
  }

  /** The server's per-field message for this control, if it sent one. */
  protected serverError(name: string): string {
    return this.action.fieldErrors()[name] ?? '';
  }

  protected next(): void {
    if (!this.validateStep(this.stepIndex())) return;
    this.stepIndex.update((index) => Math.min(STEPS.length - 1, index + 1));
  }

  protected back(): void {
    this.stepIndex.update((index) => Math.max(0, index - 1));
  }

  protected jump(index: number): void {
    // Only ever backwards — forward movement has to pass validation.
    if (index < this.stepIndex()) this.stepIndex.set(index);
  }

  protected async submit(): Promise<void> {
    if (!this.validateStep(this.stepIndex())) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      // Land the user on the first step that still has a problem.
      const broken = STEP_FIELDS.findIndex((fields) =>
        fields.some((name) => this.form.get(name)?.invalid),
      );
      if (broken >= 0) this.stepIndex.set(broken);
      return;
    }

    const raw = this.form.getRawValue();
    const user = await this.action.run(() =>
      this.auth.register({
        ...raw,
        // Free-text lists are typed comma-separated and stored as arrays.
        conditions: splitList(raw.conditions),
        allergies: splitList(raw.allergies),
        currentMedicines: splitList(raw.currentMedicines),
        confirmPassword: undefined,
        consent: undefined,
      }),
    );

    if (!user) {
      // A server-side field error belongs on the step that owns that field.
      const rejected = Object.keys(this.action.fieldErrors());
      const step = STEP_FIELDS.findIndex((fields) => fields.some((name) => rejected.includes(name)));
      if (step >= 0) this.stepIndex.set(step);
      return;
    }

    await this.router.navigateByUrl('/patient/dashboard');
    this.toasts.success(
      'Your record is ready',
      `Patient ID ${user.profileId}. It is also your QR code at reception.`,
      { label: 'View profile', link: '/patient/profile' },
    );
  }

  /** Marks one step's controls touched and reports whether they all pass. */
  private validateStep(index: number): boolean {
    const fields = this.fields(index);
    let valid = true;

    for (const name of fields) {
      const control = this.form.get(name);
      if (!control) continue;

      control.markAsTouched();
      if (control.invalid) valid = false;
    }

    // Cross-field rules belong to the step that owns the fields they compare.
    if (index === 2 && this.form.errors?.['guardian']) valid = false;
    if (index === 3 && this.form.errors?.['mismatch']) valid = false;

    return valid;
  }
}

/* -------------------------------------------------------------- validators */

function notInFuture(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return control.value > new Date().toISOString().slice(0, 10) ? { future: true } : null;
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;

  return confirm && password !== confirm ? { mismatch: true } : null;
}

/**
 * The one rule that changes shape as the form is filled in: guardian details
 * are optional for an adult and mandatory for a minor.
 */
function guardianRequiredForMinors(group: AbstractControl): ValidationErrors | null {
  const dob = group.get('dateOfBirth')?.value;
  if (!dob) return null;

  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const eighteenth = new Date(birth.getFullYear() + 18, birth.getMonth(), birth.getDate());
  if (eighteenth <= new Date()) return null;

  const missing =
    !group.get('guardianName')?.value ||
    !group.get('guardianMobile')?.value ||
    !group.get('guardianRelationship')?.value;

  return missing ? { guardian: true } : null;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
