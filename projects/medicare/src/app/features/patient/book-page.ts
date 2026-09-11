import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ActionState,
  AppointmentService,
  AuthService,
  CatalogService,
  lazyState,
  PatientService,
  ToastService,
  type Doctor,
  type Slot,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CONTROLS, type Step } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const STEPS: readonly Step[] = [
  { id: 'department', label: 'Department' },
  { id: 'doctor', label: 'Doctor' },
  { id: 'date', label: 'Date' },
  { id: 'slot', label: 'Time' },
  { id: 'reason', label: 'Reason' },
  { id: 'review', label: 'Review' },
];

/**
 * The booking wizard.
 *
 * Six steps to a held slot, then payment on its own screen and confirmation
 * after it settles. The split matters: the appointment is created `pending`
 * here, and only the payment confirms it, so an abandoned card form leaves a
 * visible unpaid booking rather than a silently lost one.
 *
 * Nothing is priced in the browser. The review step shows the fee the server
 * quoted when it created the booking.
 */
@Component({
  selector: 'mc-book-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_CONTROLS, ...MC_PIPES],
  templateUrl: './book-page.html',
  styleUrl: './book-page.scss',
})
export class BookAppointmentPage {
  protected readonly catalog = inject(CatalogService);

  private readonly appointments = inject(AppointmentService);
  private readonly patients = inject(PatientService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);

  protected readonly steps = STEPS;
  protected readonly stepIndex = signal(0);
  protected readonly action = new ActionState();

  /* --------------------------------------------------------- selections */

  protected readonly departmentId = signal('');
  protected readonly doctorId = signal('');
  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly reason = signal('');
  protected readonly consultationType = signal<'in-person' | 'online'>('in-person');
  protected readonly familyMemberId = signal('');
  protected readonly symptoms = signal<readonly string[]>([]);

  /* ------------------------------------------------------------- loaders */

  protected readonly doctors = lazyState(() =>
    this.catalog.doctors({ departmentId: this.departmentId(), sort: '-rating', limit: 50 }),
  );

  protected readonly days = lazyState(() => this.catalog.slotSummary(this.doctorId(), 21));

  protected readonly slots = lazyState(() => this.catalog.slots(this.doctorId(), this.date()));

  protected readonly family = lazyState(() =>
    this.patients.family(this.auth.profileId() ?? ''),
  );

  protected readonly doctor = signal<Doctor | null>(null);

  /* ------------------------------------------------------------ derived */

  protected readonly department = computed(() => this.catalog.department(this.departmentId()));

  /** Which step the user may advance to, given what is chosen so far. */
  protected readonly canAdvance = computed(() => {
    switch (this.stepIndex()) {
      case 0:
        return !!this.departmentId();
      case 1:
        return !!this.doctorId();
      case 2:
        return !!this.date();
      case 3:
        return !!this.time();
      case 4:
        return this.reason().trim().length >= 5;
      default:
        return true;
    }
  });

  protected readonly fee = computed(() => {
    const doctor = this.doctor();
    return doctor ? doctor.consultationFee : 0;
  });

  /** The common symptom chips offered on the reason step, by department. */
  protected readonly symptomSuggestions = computed(() => {
    const id = this.departmentId();

    return (
      SYMPTOMS[id] ?? [
        'Fever',
        'Body ache',
        'Fatigue',
        'Loss of appetite',
        'Headache',
        'Nausea',
      ]
    );
  });

  constructor() {
    void this.catalog.loadReference().catch(() => undefined);
    void this.family.load();

    // Arriving from a doctor card or a "book this slot" link skips straight
    // to the step that still needs an answer.
    const params = this.route.snapshot.queryParamMap;
    const doctorId = params.get('doctorId');

    if (doctorId) void this.preselect(doctorId, params.get('date'), params.get('time'));
  }

  /* ------------------------------------------------------------ actions */

  protected chooseDepartment(id: string): void {
    this.departmentId.set(id);
    this.doctorId.set('');
    this.doctor.set(null);
    this.date.set('');
    this.time.set('');

    void this.doctors.load();
    this.stepIndex.set(1);
  }

  protected chooseDoctor(doctor: Doctor): void {
    this.doctorId.set(doctor.id);
    this.doctor.set(doctor);
    this.date.set('');
    this.time.set('');

    // An online-only doctor should not be left on the in-person default.
    if (!doctor.acceptsOnline) this.consultationType.set('in-person');

    void this.days.load();
    this.stepIndex.set(2);
  }

  protected chooseDate(date: string): void {
    this.date.set(date);
    this.time.set('');

    void this.slots.load();
    this.stepIndex.set(3);
  }

  protected chooseSlot(slot: Slot): void {
    if (!slot.available) return;

    this.time.set(slot.time);
    this.stepIndex.set(4);
  }

  protected toggleSymptom(symptom: string): void {
    this.symptoms.update((current) =>
      current.includes(symptom)
        ? current.filter((entry) => entry !== symptom)
        : [...current, symptom],
    );
  }

  protected next(): void {
    if (this.canAdvance()) this.stepIndex.update((index) => Math.min(STEPS.length - 1, index + 1));
  }

  protected back(): void {
    this.stepIndex.update((index) => Math.max(0, index - 1));
  }

  protected jump(index: number): void {
    if (index < this.stepIndex()) this.stepIndex.set(index);
  }

  /**
   * Creates the booking and hands off to payment.
   *
   * A 409 here means somebody took the slot while this wizard was open, so the
   * user is dropped back on the slot step with a fresh list rather than shown
   * a dead end.
   */
  protected async confirm(): Promise<void> {
    const booking = await this.action.run(() =>
      this.appointments.book({
        doctorId: this.doctorId(),
        date: this.date(),
        time: this.time(),
        reason: this.reason().trim(),
        consultationType: this.consultationType(),
        symptoms: this.symptoms(),
        familyMemberId: this.familyMemberId() || null,
      }),
    );

    if (!booking) {
      if (this.action.error()?.status === 409) {
        this.time.set('');
        this.stepIndex.set(3);
        void this.slots.load();
      }
      return;
    }

    this.toasts.info('Slot held', 'Complete the payment to confirm your appointment.');
    await this.router.navigate(['/patient/pay', booking.payment.id], {
      queryParams: { from: 'booking' },
    });
  }

  /** Sets up the wizard from a deep link, then parks on the first open step. */
  private async preselect(doctorId: string, date: string | null, time: string | null): Promise<void> {
    try {
      const doctor = await this.catalog.doctor(doctorId);

      this.departmentId.set(doctor.departmentId);
      this.doctorId.set(doctor.id);
      this.doctor.set(doctor);

      void this.doctors.load();
      void this.days.load();

      if (date) {
        this.date.set(date);
        await this.slots.load();

        if (time) {
          this.time.set(time);
          this.stepIndex.set(4);
          return;
        }

        this.stepIndex.set(3);
        return;
      }

      this.stepIndex.set(2);
    } catch {
      // A bad link just starts the wizard at the beginning.
      this.stepIndex.set(0);
    }
  }
}

/** Department-specific symptom chips — quicker than typing on a phone. */
const SYMPTOMS: Record<string, readonly string[]> = {
  cardiology: ['Chest pain', 'Palpitations', 'Breathlessness', 'Swollen ankles', 'Dizziness'],
  neurology: ['Headache', 'Seizure', 'Numbness', 'Tremor', 'Memory trouble'],
  orthopedics: ['Joint pain', 'Back pain', 'Swelling', 'Stiffness', 'Injury'],
  dermatology: ['Rash', 'Itching', 'Hair fall', 'Acne', 'Pigmentation'],
  pediatrics: ['Fever', 'Cough', 'Poor feeding', 'Rash', 'Vaccination'],
  gastroenterology: ['Acidity', 'Abdominal pain', 'Nausea', 'Constipation', 'Loose motions'],
  pulmonology: ['Cough', 'Wheezing', 'Breathlessness', 'Chest tightness', 'Snoring'],
  ent: ['Sore throat', 'Blocked nose', 'Ear pain', 'Hearing loss', 'Vertigo'],
  ophthalmology: ['Blurred vision', 'Redness', 'Watering', 'Eye pain', 'Floaters'],
  psychiatry: ['Low mood', 'Anxiety', 'Poor sleep', 'Panic attacks', 'Irritability'],
};
