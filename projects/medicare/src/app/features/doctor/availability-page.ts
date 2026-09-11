import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  DAY_KEYS,
  DAY_LABELS,
  DoctorService,
  lazyState,
  ToastService,
  type DayKey,
  type DoctorAvailability,
  type DoctorLeave,
  type TimeWindow,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { DataState } from '../../shared/ui/data-state';
import { ConfirmService } from '../../shared/ui/dialogs';
import { MC_PIPES } from '../../shared/pipes';

/**
 * Working hours and leave.
 *
 * This is the screen that decides what patients can book — slots are generated
 * from this schedule on every request, so saving here changes the booking
 * calendar immediately with nothing to regenerate.
 *
 * Leave does not silently cancel anything. Booking days you are already
 * committed on returns the clashing appointments so you can deal with each one.
 */
@Component({
  selector: 'mc-availability-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, DataState, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './availability-page.html',
  styleUrl: './availability-page.scss',
})
export class AvailabilityPage {
  private readonly doctors = inject(DoctorService);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly days = DAY_KEYS.map((key) => ({ key, label: DAY_LABELS[key] }));
  protected readonly slotOptions = [10, 15, 20, 30, 45, 60];
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly saving = new ActionState();
  protected readonly leaveAction = new ActionState();

  /** Appointments that clash with newly booked leave, surfaced for a decision. */
  protected readonly clashes = signal<readonly { id: string; date: string; time: string; patientName: string }[]>([]);

  private readonly doctorId = this.auth.profileId() ?? '';

  /** The editable copy. The loaded value is only a starting point. */
  protected readonly draft = signal<DoctorAvailability | null>(null);

  protected readonly availability = lazyState(async () => {
    const loaded = await this.doctors.availability(this.doctorId);
    this.draft.set(structuredClone(loaded));
    return loaded;
  });

  protected readonly leaves = lazyState(() => this.doctors.leaves(this.doctorId));

  protected readonly leaveForm = inject(FormBuilder).nonNullable.group({
    from: ['', [Validators.required]],
    to: ['', [Validators.required]],
    reason: ['', [Validators.required, Validators.minLength(3)]],
  });

  /** Hours a week, so a schedule change has a number attached to it. */
  protected readonly weeklyHours = computed(() => {
    const schedule = this.draft()?.schedule ?? {};

    let minutes = 0;
    for (const day of DAY_KEYS) {
      const entry = schedule[day];
      if (!entry?.working) continue;

      for (const window of entry.windows) {
        minutes += toMinutes(window.end) - toMinutes(window.start);
      }
    }

    return Math.round((minutes / 60) * 10) / 10;
  });

  /** Roughly how many patients that schedule can take in a week. */
  protected readonly weeklyCapacity = computed(() => {
    const draft = this.draft();
    if (!draft) return 0;

    return Math.floor((this.weeklyHours() * 60) / draft.slotMinutes) * draft.maxPerSlot;
  });

  constructor() {
    void this.availability.load();
    void this.leaves.load();
  }

  /* ------------------------------------------------------------ editing */

  protected dayOf(key: DayKey) {
    return this.draft()?.schedule[key] ?? { working: false, windows: [] };
  }

  protected toggleDay(key: DayKey): void {
    this.mutate((schedule) => {
      const current = schedule[key] ?? { working: false, windows: [] };

      schedule[key] = current.working
        ? { working: false, windows: [] }
        : // Turning a day on gives it a sensible morning clinic to edit.
          { working: true, windows: [{ start: '09:30', end: '13:30' }] };
    });
  }

  protected addWindow(key: DayKey): void {
    this.mutate((schedule) => {
      const current = schedule[key] ?? { working: true, windows: [] };
      schedule[key] = {
        working: true,
        windows: [...current.windows, { start: '16:00', end: '20:00' }],
      };
    });
  }

  protected removeWindow(key: DayKey, index: number): void {
    this.mutate((schedule) => {
      const current = schedule[key];
      if (!current) return;

      const windows = current.windows.filter((_window, position) => position !== index);
      schedule[key] = { working: windows.length > 0, windows };
    });
  }

  protected setWindow(key: DayKey, index: number, part: keyof TimeWindow, value: string): void {
    this.mutate((schedule) => {
      const current = schedule[key];
      if (!current) return;

      schedule[key] = {
        ...current,
        windows: current.windows.map((window, position) =>
          position === index ? { ...window, [part]: value } : window,
        ),
      };
    });
  }

  protected setSlotMinutes(minutes: number): void {
    this.draft.update((draft) => (draft ? { ...draft, slotMinutes: minutes } : draft));
  }

  protected setMaxPerSlot(count: number): void {
    this.draft.update((draft) => (draft ? { ...draft, maxPerSlot: Math.max(1, count) } : draft));
  }

  /** Copies one day's windows to every other working day. */
  protected copyToAll(key: DayKey): void {
    const source = this.dayOf(key);

    this.mutate((schedule) => {
      for (const day of DAY_KEYS) {
        if (day === key) continue;
        if (!schedule[day]?.working) continue;

        schedule[day] = { working: true, windows: source.windows.map((window) => ({ ...window })) };
      }
    });

    this.toasts.info(`${DAY_LABELS[key]} copied to every working day`);
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft) return;

    const invalid = DAY_KEYS.some((day) =>
      (draft.schedule[day]?.windows ?? []).some((window) => toMinutes(window.end) <= toMinutes(window.start)),
    );

    if (invalid) {
      this.toasts.error('Check your hours', 'A session must end after it starts.');
      return;
    }

    const saved = await this.saving.run(() => this.doctors.saveAvailability(this.doctorId, draft));
    if (!saved) {
      this.toasts.error('Could not save', this.saving.error()?.message);
      return;
    }

    this.availability.set(saved);
    this.draft.set(structuredClone(saved));
    this.toasts.success('Hours published', 'Patients can book against the new schedule now.');
  }

  protected reset(): void {
    const loaded = this.availability.data();
    if (loaded) this.draft.set(structuredClone(loaded));
  }

  /* -------------------------------------------------------------- leave */

  protected async addLeave(): Promise<void> {
    if (this.leaveForm.invalid) {
      this.leaveForm.markAllAsTouched();
      return;
    }

    const result = await this.leaveAction.run(() =>
      this.doctors.addLeave(this.doctorId, this.leaveForm.getRawValue()),
    );

    if (!result) {
      this.toasts.error('Could not book that leave', this.leaveAction.error()?.message);
      return;
    }

    this.leaveForm.reset();
    this.clashes.set(
      result.clashes.map((row) => ({
        id: row.id,
        date: row.date,
        time: row.time,
        patientName: row.patientName,
      })),
    );

    this.toasts.success(
      'Leave recorded',
      result.clashes.length
        ? `${result.clashes.length} appointment(s) already booked in that range.`
        : 'Those dates are now unbookable.',
    );

    void this.leaves.load();
  }

  protected async removeLeave(leave: DoctorLeave): Promise<void> {
    const agreed = await this.confirm.ask({
      heading: 'Remove this leave?',
      body: `${leave.from} to ${leave.to} becomes bookable again.`,
      confirmLabel: 'Remove leave',
    });

    if (!agreed) return;

    const done = await this.leaveAction.run(() => this.doctors.removeLeave(this.doctorId, leave.id));
    if (!done) return;

    this.toasts.success('Leave removed');
    void this.leaves.load();
  }

  /** Applies a change to a copy of the schedule and stores it back. */
  private mutate(change: (schedule: Record<string, { working: boolean; windows: TimeWindow[] }>) => void): void {
    this.draft.update((draft) => {
      if (!draft) return draft;

      const schedule = structuredClone(draft.schedule) as Record<
        string,
        { working: boolean; windows: TimeWindow[] }
      >;
      change(schedule);

      return { ...draft, schedule };
    });
  }
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}
