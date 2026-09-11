import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  ActionState,
  AppointmentService,
  CatalogService,
  ClinicalService,
  lazyState,
  PatientService,
  TEST_CATEGORIES,
  ToastService,
  trackedState,
  type Consultation,
  type Medicine,
  type TestCategory,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS, type Step } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { ConfirmService, Modal } from '../../shared/ui/dialogs';
import { MC_PIPES } from '../../shared/pipes';

const STEPS: readonly Step[] = [
  { id: 'history', label: 'History' },
  { id: 'examination', label: 'Examination' },
  { id: 'diagnosis', label: 'Diagnosis' },
  { id: 'prescription', label: 'Prescription' },
  { id: 'tests', label: 'Tests' },
  { id: 'close', label: 'Close visit' },
];

const FREQUENCIES = ['Once daily', 'Twice daily', 'Thrice daily', 'Every 6 hours', 'Every 8 hours', 'At bedtime', 'As needed'];
const TIMINGS = ['After food', 'Before food', 'With food', 'Empty stomach'];
const ROUTES = ['Oral', 'Topical', 'Intravenous', 'Intramuscular', 'Inhaled', 'Nasal'];

/**
 * The consultation.
 *
 * Six steps that mirror how a visit actually goes: read the history, record the
 * examination, commit to a diagnosis, prescribe, order tests, close. The draft
 * is saved to the server as the doctor moves between steps, so a dropped
 * connection or a closed tab mid-visit does not lose the notes.
 *
 * Closing the visit is the moment everything becomes permanent: the appointment
 * completes, the medical record is written, and the patient is notified. That
 * is why the server refuses to close a consultation without a diagnosis.
 */
@Component({
  selector: 'mc-consultation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, DataState, Modal, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  templateUrl: './consultation-page.html',
  styleUrl: './consultation-page.scss',
})
export class ConsultationPage {
  readonly appointmentId = input.required<string>();

  private readonly clinical = inject(ClinicalService);
  private readonly appointments = inject(AppointmentService);
  private readonly patients = inject(PatientService);
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly steps = STEPS;
  protected readonly frequencies = FREQUENCIES;
  protected readonly timings = TIMINGS;
  protected readonly routes = ROUTES;
  protected readonly testCategories = TEST_CATEGORIES;

  protected readonly stepIndex = signal(0);
  protected readonly saving = new ActionState();
  protected readonly closing = new ActionState();
  protected readonly rxAction = new ActionState();
  protected readonly testAction = new ActionState();

  /** Set when the server warns that a drug clashes with a known allergy. */
  protected readonly allergyWarning = signal<string | null>(null);

  protected readonly appointment = trackedState(
    () => this.appointmentId(),
    () => this.appointments.get(this.appointmentId()),
  );

  /** Opening the consultation is idempotent — a reload resumes the draft. */
  protected readonly consultation = trackedState(
    () => this.appointmentId(),
    async () => {
      const opened = await this.clinical.openConsultation(this.appointmentId());
      this.fill(opened);
      return opened;
    },
  );

  /**
   * Keyed off the loaded appointment rather than the route, because the patient
   * id only exists once that request has come back.
   */
  protected readonly history = trackedState(
    () => this.appointment.data()?.patientId,
    async () => {
      const patientId = this.appointment.data()?.patientId;
      if (!patientId) return { years: [], total: 0 };

      return this.patients.timeline(patientId);
    },
  );

  protected readonly tests = lazyState(() =>
    this.clinical.testRequests({ consultationId: this.consultation.data()?.id ?? '', limit: 20 }),
  );

  /* ------------------------------------------------------------- forms */

  protected readonly form = this.fb.nonNullable.group({
    chiefComplaint: ['', [Validators.required]],
    symptoms: [''],
    examination: [''],
    heightCm: [null as number | null],
    weightKg: [null as number | null],
    temperatureF: [null as number | null],
    pulse: [null as number | null],
    systolic: [null as number | null],
    diastolic: [null as number | null],
    spo2: [null as number | null],
    sugarMgDl: [null as number | null],
    diagnosis: [''],
    treatmentPlan: [''],
    notes: [''],
    followUpDate: [''],
    followUpReason: [''],
  });

  protected readonly prescriptionForm = this.fb.nonNullable.group({
    advice: [''],
    medicines: this.fb.array<ReturnType<typeof this.medicineGroup>>([]),
  });

  protected readonly testForm = this.fb.nonNullable.group({
    testName: ['', [Validators.required]],
    category: ['blood' as TestCategory, [Validators.required]],
    priority: ['routine'],
    clinicalReason: ['', [Validators.required]],
    notes: [''],
  });

  protected readonly medicineSearch = signal('');
  protected readonly pickerOpen = signal(false);
  protected readonly pickerIndex = signal(0);

  protected readonly medicineResults = lazyState(() =>
    this.catalog.medicines({ q: this.medicineSearch(), inStock: true, limit: 12 }),
  );

  protected get medicines(): FormArray {
    return this.prescriptionForm.controls.medicines as unknown as FormArray;
  }

  /* ----------------------------------------------------------- derived */

  protected readonly patient = computed(() => this.appointment.data()?.patient ?? null);

  /**
   * The form's values as a signal.
   *
   * A `computed()` reading `form.controls.x.value` directly would never
   * recompute — a FormControl is not reactive to the signal graph — so anything
   * derived from the form reads through here instead.
   */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly canClose = computed(() => !!this.formValue().diagnosis?.trim());

  protected readonly bmi = computed(() => {
    const { heightCm, weightKg } = this.formValue();
    if (!heightCm || !weightKg) return null;

    return (weightKg / (heightCm / 100) ** 2).toFixed(1);
  });

  /* ------------------------------------------------------------ steps */

  protected async goTo(index: number): Promise<void> {
    // Save on every step change, so the draft on the server is never more than
    // one step behind what is on screen.
    await this.saveDraft();
    this.stepIndex.set(Math.max(0, Math.min(STEPS.length - 1, index)));

    if (STEPS[this.stepIndex()].id === 'tests') void this.tests.load();
  }

  protected next(): void {
    void this.goTo(this.stepIndex() + 1);
  }

  protected back(): void {
    void this.goTo(this.stepIndex() - 1);
  }

  /* ------------------------------------------------------------ saving */

  protected async saveDraft(): Promise<void> {
    const consultation = this.consultation.data();
    if (!consultation) return;

    const raw = this.form.getRawValue();

    await this.saving.run(() =>
      this.clinical.saveConsultation(consultation.id, {
        chiefComplaint: raw.chiefComplaint,
        symptoms: splitList(raw.symptoms),
        examination: raw.examination,
        vitals: {
          heightCm: raw.heightCm ?? undefined,
          weightKg: raw.weightKg ?? undefined,
          temperatureF: raw.temperatureF ?? undefined,
          pulse: raw.pulse ?? undefined,
          systolic: raw.systolic ?? undefined,
          diastolic: raw.diastolic ?? undefined,
          spo2: raw.spo2 ?? undefined,
          sugarMgDl: raw.sugarMgDl ?? undefined,
        },
        diagnosis: raw.diagnosis,
        treatmentPlan: raw.treatmentPlan,
        notes: raw.notes,
        followUpDate: raw.followUpDate || null,
        followUpReason: raw.followUpReason,
      }),
    );
  }

  /* ------------------------------------------------------ prescription */

  private medicineGroup(medicine?: Medicine) {
    return this.fb.nonNullable.group({
      medicineId: [medicine?.id ?? ''],
      name: [medicine?.name ?? '', [Validators.required]],
      genericName: [medicine?.genericName ?? ''],
      strength: [medicine?.strength ?? ''],
      form: [medicine?.form ?? ''],
      dosage: ['1 tablet', [Validators.required]],
      frequency: ['Twice daily', [Validators.required]],
      duration: ['5 days', [Validators.required]],
      timing: ['After food'],
      route: ['Oral'],
      instructions: [''],
    });
  }

  protected addMedicineRow(): void {
    this.medicines.push(this.medicineGroup());
  }

  protected removeMedicine(index: number): void {
    this.medicines.removeAt(index);
  }

  protected openPicker(index: number): void {
    this.pickerIndex.set(index);
    this.pickerOpen.set(true);
    void this.medicineResults.load();
  }

  protected searchMedicines(query: string): void {
    this.medicineSearch.set(query);
    void this.medicineResults.load();
  }

  /** Fills the row that opened the picker with a catalogue medicine. */
  protected chooseMedicine(medicine: Medicine): void {
    const group = this.medicines.at(this.pickerIndex());
    if (!group) return;

    group.patchValue({
      medicineId: medicine.id,
      name: medicine.name,
      genericName: medicine.genericName,
      strength: medicine.strength,
      form: medicine.form,
      route: medicine.form === 'Cream' || medicine.form === 'Gel' ? 'Topical' : 'Oral',
      dosage: medicine.form === 'Syrup' ? '5 mL' : `1 ${medicine.form.toLowerCase()}`,
    });

    this.pickerOpen.set(false);
  }

  protected async savePrescription(acknowledge = false): Promise<void> {
    const consultation = this.consultation.data();
    if (!consultation) return;

    if (this.medicines.length === 0) {
      this.toasts.warning('Nothing to save', 'Add at least one medicine.');
      return;
    }

    if (this.prescriptionForm.invalid) {
      this.prescriptionForm.markAllAsTouched();
      return;
    }

    this.allergyWarning.set(null);

    const saved = await this.rxAction.run(() =>
      this.clinical.savePrescription({
        consultationId: consultation.id,
        diagnosis: this.form.controls.diagnosis.value || consultation.chiefComplaint,
        medicines: this.medicines.getRawValue(),
        advice: this.prescriptionForm.controls.advice.value,
        followUpDate: this.form.controls.followUpDate.value || null,
        acknowledgeAllergy: acknowledge,
      }),
    );

    if (!saved) {
      // The server refuses a clashing drug once, and accepts it on a second
      // pass — the doctor has to see the warning before overriding it.
      const error = this.rxAction.error();
      if (error?.status === 400 && error.message.toLowerCase().includes('allergic')) {
        this.allergyWarning.set(error.message);
      }
      return;
    }

    this.toasts.success('Prescription saved', `${saved.medicines.length} medicines · ${saved.id}`);
  }

  /* ------------------------------------------------------------- tests */

  protected async requestTest(): Promise<void> {
    const consultation = this.consultation.data();
    if (!consultation || this.testForm.invalid) {
      this.testForm.markAllAsTouched();
      return;
    }

    const raw = this.testForm.getRawValue();
    const created = await this.testAction.run(() =>
      this.clinical.requestTest({
        consultationId: consultation.id,
        testName: raw.testName,
        category: raw.category,
        priority: raw.priority as 'routine' | 'urgent',
        clinicalReason: raw.clinicalReason,
        notes: raw.notes,
      }),
    );

    if (!created) return;

    this.testForm.reset({ category: 'blood', priority: 'routine' });
    this.toasts.success(`${created.testName} requested`, 'The patient has been notified.');
    void this.tests.load();
  }

  /* ------------------------------------------------------------- close */

  protected async complete(): Promise<void> {
    const consultation = this.consultation.data();
    if (!consultation) return;

    await this.saveDraft();

    const agreed = await this.confirm.ask({
      heading: 'Complete this consultation?',
      body: 'The visit is marked complete, the medical record is written and the patient is notified. Notes can no longer be changed.',
      confirmLabel: 'Complete visit',
    });

    if (!agreed) return;

    const done = await this.closing.run(() => this.clinical.completeConsultation(consultation.id));
    if (!done) {
      this.toasts.error('Could not complete the visit', this.closing.error()?.message);
      return;
    }

    this.toasts.success('Consultation complete', `Record ${done.record.id} written.`);
    await this.router.navigateByUrl('/doctor/queue');
  }

  /* ----------------------------------------------------------- helpers */

  private fill(consultation: Consultation): void {
    const vitals = consultation.vitals ?? {};

    this.form.patchValue({
      chiefComplaint: consultation.chiefComplaint,
      symptoms: consultation.symptoms.join(', '),
      examination: consultation.examination,
      heightCm: vitals.heightCm ?? null,
      weightKg: vitals.weightKg ?? null,
      temperatureF: vitals.temperatureF ?? null,
      pulse: vitals.pulse ?? null,
      systolic: vitals.systolic ?? null,
      diastolic: vitals.diastolic ?? null,
      spo2: vitals.spo2 ?? null,
      sugarMgDl: vitals.sugarMgDl ?? null,
      diagnosis: consultation.diagnosis,
      treatmentPlan: consultation.treatmentPlan,
      notes: consultation.notes,
      followUpDate: consultation.followUpDate ?? '',
      followUpReason: consultation.followUpReason,
    });

    // A resumed visit brings back whatever was already prescribed.
    this.medicines.clear();
    for (const line of consultation.prescription?.medicines ?? []) {
      const group = this.medicineGroup();
      group.patchValue(line);
      this.medicines.push(group);
    }

    if (this.medicines.length === 0) this.addMedicineRow();
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
