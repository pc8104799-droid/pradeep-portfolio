import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  asyncState,
  AuthService,
  PatientService,
  StatsService,
  type PatientSummary,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { MC_CHARTS } from '../../shared/ui/charts';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

/**
 * The patient's home screen.
 *
 * Built around one question: what does this person need to do next? The next
 * appointment, an unpaid bill and a new report come first; the history and the
 * charts are underneath. Two requests back it — the joined summary and the
 * dashboard numbers — rather than a dozen small ones.
 */
@Component({
  selector: 'mc-patient-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataState, ...MC_ATOMS, ...MC_CHARTS, ...MC_PIPES],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class PatientDashboardPage {
  private readonly patients = inject(PatientService);
  private readonly stats = inject(StatsService);

  protected readonly auth = inject(AuthService);

  private readonly patientId = this.auth.profileId() ?? '';

  protected readonly summary = asyncState(() => this.patients.summary(this.patientId));
  protected readonly dashboard = asyncState(() => this.stats.patient(this.patientId));

  protected readonly firstName = computed(
    () => this.auth.user()?.name.split(' ')[0] ?? 'there',
  );

  /** Morning / afternoon / evening — small, but it makes the screen feel live. */
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  /**
   * The one thing the patient should act on, chosen in priority order:
   * an unpaid bill, then a visit today, then anything booked ahead.
   */
  protected readonly callToAction = computed(() => {
    const data = this.summary.data();
    if (!data) return null;

    const unpaid = data.pendingPayments[0];
    if (unpaid) {
      return {
        tone: 'warning' as const,
        title: 'A payment is still pending',
        body: `${unpaid.kind === 'consultation' ? 'Consultation' : 'Medicine order'} · ₹${unpaid.amount}. Your booking is only confirmed once this is paid.`,
        label: 'Pay now',
        link: ['/patient/pay', unpaid.id],
      };
    }

    const next = data.upcomingAppointment;
    if (!next) {
      return {
        tone: 'info' as const,
        title: 'No upcoming appointments',
        body: 'Search by department or symptom and book a slot that suits you.',
        label: 'Find a doctor',
        link: ['/patient/doctors'],
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (next.date === today && next.status === 'confirmed') {
      return {
        tone: 'success' as const,
        title: `You are seeing ${next.doctorName} today`,
        body: `${next.time} · ${next.departmentName}. Check in at reception with your QR code.`,
        label: 'Open appointment',
        link: ['/patient/appointments', next.id],
      };
    }

    return {
      tone: 'info' as const,
      title: `Next: ${next.doctorName}`,
      body: `${next.departmentName} · ${next.date} at ${next.time}`,
      label: 'View details',
      link: ['/patient/appointments', next.id],
    };
  });

  /** The tiles across the top of the dashboard. */
  protected readonly tiles = computed(() => {
    const data = this.summary.data();
    const numbers = this.dashboard.data();
    if (!data) return [];

    return [
      {
        label: 'Appointments',
        value: data.counts.appointments,
        hint: `${numbers?.upcoming ?? 0} upcoming`,
        link: '/patient/appointments',
      },
      {
        label: 'Prescriptions',
        value: data.counts.prescriptions,
        hint: data.latestPrescription ? 'Latest ready to order' : 'None yet',
        link: '/patient/prescriptions',
      },
      {
        label: 'Lab reports',
        value: data.counts.reports,
        hint: `${data.recentReports.filter((row) => row.status === 'attention').length} need attention`,
        link: '/patient/reports',
      },
      {
        label: 'Medicine orders',
        value: data.counts.orders,
        hint: `${data.activeOrders.length} in progress`,
        link: '/patient/pharmacy/orders',
      },
    ];
  });

  protected reload(): void {
    void this.summary.load();
    void this.dashboard.load();
  }

  /** Re-reads after something on this page changed the underlying data. */
  protected refreshAfter(promise: Promise<unknown>): void {
    void promise.then(() => this.reload());
  }

  protected allergyList(data: PatientSummary): string {
    return data.patient.allergies.length ? data.patient.allergies.join(', ') : 'None recorded';
  }
}
