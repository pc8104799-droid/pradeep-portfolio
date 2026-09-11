import type { Panel, Role } from '@pc/medicare-core';

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
 * Navigation is a list rather than markup so the sidebar and the mobile drawer
 * read from one source — and so adding a screen is one entry here plus one
 * route, with nothing to keep in sync by hand.
 *
 * Four panels, one per role. They are separate rather than one list with
 * per-role filtering because the four jobs barely overlap: a patient manages
 * their own care, a doctor runs a clinic, reception runs the building, and the
 * pharmacy runs a counter.
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

const ADMIN_NAV: readonly NavSection[] = [
  {
    title: 'Front desk',
    links: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: '⌂', hint: "Today across the hospital" },
      { label: 'Appointments', path: '/admin/appointments', icon: '◷', hint: 'Check in, move, cancel' },
      { label: 'Register a patient', path: '/admin/register', icon: '✚', hint: 'Walk-in registration' },
      { label: 'Scan a code', path: '/admin/qr', icon: '▦', hint: 'Check in by QR' },
    ],
  },
  {
    title: 'Directory',
    links: [
      { label: 'Patients', path: '/admin/patients', icon: '⚭' },
      { label: 'Doctors', path: '/admin/doctors', icon: '☤', hint: 'Fees, hours and leave' },
      { label: 'Departments', path: '/admin/departments', icon: '⌸' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { label: 'Payments', path: '/admin/payments', icon: '₹', hint: 'Every transaction' },
      { label: 'Pharmacy orders', path: '/admin/orders', icon: '▤' },
      { label: 'Notifications', path: '/admin/notifications', icon: '◉', badge: 'notifications' },
      { label: 'Appearance', path: '/admin/settings', icon: '◐' },
    ],
  },
];

const PHARMACY_NAV: readonly NavSection[] = [
  {
    title: 'Counter',
    links: [
      { label: 'Dashboard', path: '/pharmacy/dashboard', icon: '⌂' },
      { label: 'Dispensing queue', path: '/pharmacy/orders', icon: '▤', hint: 'Orders to fulfil' },
      { label: 'Verify a prescription', path: '/pharmacy/verify', icon: '℞', hint: 'By ID or QR' },
      { label: 'Scan a code', path: '/pharmacy/qr', icon: '▦' },
    ],
  },
  {
    title: 'Stock',
    links: [
      { label: 'Inventory', path: '/pharmacy/inventory', icon: '⊞', hint: 'Restock and reprice' },
      { label: 'Catalogue', path: '/pharmacy/catalogue', icon: '⌕', hint: 'What patients see' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Notifications', path: '/pharmacy/notifications', icon: '◉', badge: 'notifications' },
      { label: 'Appearance', path: '/pharmacy/settings', icon: '◐' },
    ],
  },
];

const NAV: Record<Panel, readonly NavSection[]> = {
  patient: PATIENT_NAV,
  doctor: DOCTOR_NAV,
  admin: ADMIN_NAV,
  pharmacy: PHARMACY_NAV,
};

export function navFor(panel: Panel): readonly NavSection[] {
  return NAV[panel] ?? PATIENT_NAV;
}

/**
 * The single action in the header — different work for different people.
 * A patient books, a doctor starts their clinic, reception registers a
 * walk-in, the pharmacy opens the dispensing queue.
 */
export function primaryActionFor(panel: Panel): NavLink {
  switch (panel) {
    case 'doctor':
      return { label: 'Open queue', path: '/doctor/queue', icon: '☰' };
    case 'admin':
      return { label: 'Register a patient', path: '/admin/register', icon: '+' };
    case 'pharmacy':
      return { label: 'Dispensing queue', path: '/pharmacy/orders', icon: '▤' };
    default:
      return { label: 'Book appointment', path: '/patient/book', icon: '+' };
  }
}

/** What to call the panel in the header. */
export function panelLabel(panel: Panel, role: Role | null): string {
  switch (panel) {
    case 'doctor':
      return 'Doctor panel';
    case 'admin':
      return 'Reception desk';
    case 'pharmacy':
      return 'Pharmacy desk';
    default:
      return role === 'patient' ? 'Patient panel' : 'MediCare360';
  }
}
