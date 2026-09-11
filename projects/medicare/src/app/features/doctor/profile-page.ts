import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  CatalogService,
  DoctorService,
  lazyState,
  ToastService,
  type Doctor,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { FieldError } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { QrCode } from '../../shared/ui/qr';
import { MC_PIPES } from '../../shared/pipes';

const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Bengali', 'Gujarati'];

/**
 * The doctor's own profile.
 *
 * Only the fields a doctor genuinely owns are editable — how to reach them,
 * which languages they consult in, what patients read about them, and whether
 * they take online consultations. Fee, department, registration number and
 * qualification are hospital administration, so they are shown as locked rather
 * than quietly omitted.
 */
@Component({
  selector: 'mc-doctor-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, DataState, QrCode, FieldError, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class DoctorProfilePage {
  private readonly doctors = inject(DoctorService);
  private readonly toasts = inject(ToastService);

  protected readonly auth = inject(AuthService);
  protected readonly catalog = inject(CatalogService);
  protected readonly languages = LANGUAGES;
  protected readonly action = new ActionState();

  private readonly doctorId = this.auth.profileId() ?? '';

  protected readonly profile = lazyState(() => this.catalog.doctor(this.doctorId));

  protected readonly form = inject(FormBuilder).nonNullable.group({
    phone: ['', [Validators.required, Validators.pattern(/^[+0-9 ()-]{10,18}$/)]],
    languages: [[] as string[]],
    about: ['', [Validators.required, Validators.minLength(20)]],
    acceptsOnline: [false],
  });

  constructor() {
    void this.profile.load().then((doctor) => {
      if (doctor) this.fill(doctor);
    });
  }

  protected control(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  protected speaks(language: string): boolean {
    return this.form.controls.languages.value.includes(language);
  }

  protected toggleLanguage(language: string): void {
    const current = this.form.controls.languages.value;

    this.form.controls.languages.setValue(
      current.includes(language)
        ? current.filter((entry) => entry !== language)
        : [...current, language],
    );

    this.form.markAsDirty();
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const saved = await this.action.run(() =>
      this.doctors.updateProfile(this.doctorId, this.form.getRawValue()),
    );

    if (!saved) return;

    this.profile.set({ ...(this.profile.data() as Doctor), ...saved });
    this.auth.updateProfile(saved);
    this.form.markAsPristine();
    this.toasts.success('Profile updated', 'Patients see the new details straight away.');
  }

  protected reset(): void {
    const doctor = this.profile.data();
    if (doctor) this.fill(doctor);
  }

  private fill(doctor: Doctor): void {
    this.form.patchValue({
      phone: doctor.phone,
      languages: [...doctor.languages],
      about: doctor.about,
      acceptsOnline: doctor.acceptsOnline,
    });

    this.form.markAsPristine();
  }
}
