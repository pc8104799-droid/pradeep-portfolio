import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  BLOOD_GROUPS,
  lazyState,
  PatientService,
  RELATIONSHIPS,
  ToastService,
  type FamilyMember,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { FieldError } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { ConfirmService, Modal } from '../../shared/ui/dialogs';
import { MC_PIPES } from '../../shared/pipes';

/**
 * Family members.
 *
 * A patient account books for a household, so each member gets their own blood
 * group, allergies and conditions — which is what makes "who is this for?" on
 * the booking screen worth asking. A member under eighteen needs a guardian,
 * the same rule the registration form applies.
 */
@Component({
  selector: 'mc-family-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, DataState, Modal, FieldError, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './family-page.html',
  styleUrl: './family-page.scss',
})
export class FamilyPage {
  private readonly patients = inject(PatientService);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly relationships = RELATIONSHIPS;
  protected readonly bloodGroups = BLOOD_GROUPS;
  protected readonly action = new ActionState();

  protected readonly editing = signal<FamilyMember | null>(null);
  protected readonly formOpen = signal(false);

  private readonly patientId = this.auth.profileId() ?? '';

  protected readonly members = lazyState(() => this.patients.family(this.patientId));

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required]],
    relationship: ['', [Validators.required]],
    dateOfBirth: ['', [Validators.required]],
    gender: ['', [Validators.required]],
    bloodGroup: ['unknown'],
    mobile: [''],
    conditions: [''],
    allergies: [''],
    guardianName: [''],
    guardianMobile: [''],
    guardianRelationship: [''],
  });

  /** Mirrors the registration rule: a minor must have a guardian on file. */
  protected readonly isMinor = computed(() => {
    const dob = this.dob();
    if (!dob) return false;

    const eighteenth = new Date(dob);
    eighteenth.setFullYear(eighteenth.getFullYear() + 18);
    return eighteenth > new Date();
  });

  private readonly dob = signal<Date | null>(null);

  constructor() {
    void this.members.load();

    this.form.controls.dateOfBirth.valueChanges.subscribe((value) => {
      const parsed = value ? new Date(`${value}T00:00:00`) : null;
      this.dob.set(parsed && !Number.isNaN(parsed.getTime()) ? parsed : null);
    });
  }

  protected control(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  protected openNew(): void {
    this.editing.set(null);
    this.form.reset({ bloodGroup: 'unknown' });
    this.action.clear();
    this.formOpen.set(true);
  }

  protected openEdit(member: FamilyMember): void {
    this.editing.set(member);
    this.action.clear();

    this.form.setValue({
      firstName: member.firstName,
      lastName: member.lastName,
      relationship: member.relationship,
      dateOfBirth: member.dateOfBirth,
      gender: member.gender,
      bloodGroup: member.bloodGroup,
      mobile: member.mobile ?? '',
      conditions: member.conditions.join(', '),
      allergies: member.allergies.join(', '),
      guardianName: member.guardianName ?? '',
      guardianMobile: member.guardianMobile ?? '',
      guardianRelationship: member.guardianRelationship ?? '',
    });

    this.formOpen.set(true);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.isMinor() && !this.form.controls.guardianName.value) {
      this.form.controls.guardianName.setErrors({ guardian: true });
      this.form.controls.guardianName.markAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      conditions: splitList(raw.conditions),
      allergies: splitList(raw.allergies),
    };

    const existing = this.editing();
    const saved = await this.action.run(() =>
      existing
        ? this.patients.updateFamilyMember(this.patientId, existing.id, payload)
        : this.patients.addFamilyMember(this.patientId, payload),
    );

    if (!saved) return;

    this.formOpen.set(false);
    this.toasts.success(existing ? 'Member updated' : `${saved.name} added`, saved.relationship);
    void this.members.load();
  }

  protected async remove(member: FamilyMember): Promise<void> {
    const agreed = await this.confirm.ask({
      heading: `Remove ${member.name}?`,
      body: 'Their details will be deleted from your account. Appointments already booked for them are not affected.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });

    if (!agreed) return;

    const done = await this.action.run(() =>
      this.patients.removeFamilyMember(this.patientId, member.id),
    );

    if (!done) {
      this.toasts.error('Could not remove', this.action.error()?.message);
      return;
    }

    this.toasts.success(`${member.name} removed`);
    void this.members.load();
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
