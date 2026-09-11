import type { Role } from '@pc/medicare-core';

export interface NavLink {
  readonly label: string;
  readonly path: string;
  /** A single glyph. Text rather than an icon font keeps the bundle honest. */
  readonly icon: string;
  readonly hint?: string;
  /** Shows the unread-notification count next to the link. */
  readonly badge?: 'notifications';
}

export interface NavSection {
  readonly title: string;
  readonly links: readonly NavLink[];
}

/**
 * The sidebar, as data.
 *
 * Navigation is a list rather than markup so the sidebar, the mobile drawer and
 * the command palette all read from one source — and so adding a screen is one
 * entry here plus one route, with nothing to keep in sync by hand.
 */
const PATIENT_NAV: readonly NavSection[] = [
  {
    title: 'Care',
    links: [
      { label: 'Dashboard', path: '/patient/dashboard', icon: '⌂', hint: 'Your health at a glance' },
      { label: 'Find a doctor', path: '/patient/doctors', icon: '⌕', hint: 'Search by department' },
      { label: 'Appointments', path: '/patient/appointments', icon: '◷', hint: 'Upcoming and past visits' },
      { label: 'Emergency', path: '/patient/emergency', icon: '✚', hint: 'Blood group, allergies, contacts' },
    ],
  },
  {
    title: 'Records',
    links: [
      { label: 'Prescriptions', path: '/patient/prescriptions', icon: '℞' },
      { label: 'Medical history', path: '/patient/records', icon: '❐' },
      { label: 'Lab reports', path: '/patient/reports', icon: '⌬' },
      { label: 'Scan a code', path: '/patient/qr', icon: '▦', hint: 'Look up any MediCare360 ID' },
    ],
  },
  {
    title: 'Pharmacy & billing',
    links: [
      { label: 'Medical store', path: '/patient/pharmacy', icon: '⊞' },
      { label: 'Medicine orders', path: '/patient/pharmacy/orders', icon: '▤' },
      { label: 'Payments', path: '/patient/payments', icon: '₹' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Family members', path: '/patient/family', icon: '⚭' },
      { label: 'Notifications', path: '/patient/notifications', icon: '◉', badge: 'notifications' },
      { label: 'Your profile', path: '/patient/profile', icon: '☺' },
      { label: 'Appearance', path: '/patient/settings', icon: '◐', hint: 'Themes and density' },
    ],
  },
];

const DOCTOR_NAV: readonly NavSection[] = [
  {
    title: 'Clinic',
    links: [
      { label: 'Dashboard', path: '/doctor/dashboard', icon: '⌂' },
      { label: "Today's queue", path: '/doctor/queue', icon: '☰', hint: 'Call and consult' },
      { label: 'Appointments', path: '/doctor/appointments', icon: '◷' },
      { label: 'Patients', path: '/doctor/patients', icon: '⚭', hint: 'Everyone you have treated' },
    ],
  },
  {
    title: 'Clinical',
    links: [
      { label: 'Prescriptions', path: '/doctor/prescriptions', icon: '℞' },
      { label: 'Reports & tests', path: '/doctor/reports', icon: '⌬' },
      { label: 'Scan a code', path: '/doctor/qr', icon: '▦' },
    ],
  },
  {
    title: 'Practice',
    links: [
      { label: 'Availability', path: '/doctor/availability', icon: '▤', hint: 'Hours and leave' },
      { label: 'Earnings', path: '/doctor/earnings', icon: '₹' },
      { label: 'Notifications', path: '/doctor/notifications', icon: '◉', badge: 'notifications' },
      { label: 'Your profile', path: '/doctor/profile', icon: '☺' },
      { label: 'Appearance', path: '/doctor/settings', icon: '◐' },
    ],
  },
];

export function navFor(panel: 'patient' | 'doctor'): readonly NavSection[] {
  return panel === 'doctor' ? DOCTOR_NAV : PATIENT_NAV;
}

/**
 * The single action in the header — different work for different people.
 * A patient books; a doctor starts their clinic.
 */
export function primaryActionFor(panel: 'patient' | 'doctor'): NavLink {
  return panel === 'doctor'
    ? { label: 'Open queue', path: '/doctor/queue', icon: '☰' }
    : { label: 'Book appointment', path: '/patient/book', icon: '+' };
}

/** What to call the panel in the header, given who is signed in. */
export function panelLabel(panel: 'patient' | 'doctor', role: Role | null): string {
  if (panel === 'doctor') return 'Doctor panel';
  if (role === 'admin') return 'Reception desk';
  if (role === 'pharmacy') return 'Pharmacy desk';
  return 'Patient panel';
}
