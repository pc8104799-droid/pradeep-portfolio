import type { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from '@pc/medicare-core';

/**
 * The route tree.
 *
 * Four shells, one per audience, each behind a role guard: `/patient/*` for
 * people receiving care, `/doctor/*` for people giving it, `/admin/*` for the
 * reception desk and `/pharmacy/*` for the dispensing counter. The split is
 * deliberate — the four roles share almost no navigation, and keeping them in
 * separate subtrees means the sidebar, the page titles and the lazy chunks all
 * divide along the same line.
 *
 * A handful of screens are genuinely shared: an appointment, a prescription, a
 * report, a patient's record, the QR scanner, notifications and appearance.
 * Those live in `features/shared-pages` and read the panel from the signed-in
 * role, so one component serves every subtree that mounts it rather than four
 * near-identical copies drifting apart.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/misc/home-redirect').then((m) => m.HomeRedirect),
  },

  /* ------------------------------------------------------------- public */

  {
    path: '',
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
        title: 'Sign in — MediCare360',
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register-page').then((m) => m.RegisterPage),
        title: 'Register as a patient — MediCare360',
      },
    ],
  },

  /* ------------------------------------------------------- patient panel */

  {
    path: 'patient',
    canActivate: [roleGuard('patient')],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    data: { panel: 'patient' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/patient/dashboard-page').then((m) => m.PatientDashboardPage),
        title: 'Dashboard — MediCare360',
      },
      {
        path: 'doctors',
        loadComponent: () => import('./features/patient/doctor-search-page').then((m) => m.DoctorSearchPage),
        title: 'Find a doctor — MediCare360',
      },
      {
        path: 'doctors/:doctorId',
        loadComponent: () => import('./features/patient/doctor-profile-page').then((m) => m.DoctorProfilePage),
        title: 'Doctor — MediCare360',
      },
      {
        path: 'book',
        loadComponent: () => import('./features/patient/book-page').then((m) => m.BookAppointmentPage),
        title: 'Book an appointment — MediCare360',
      },
      {
        path: 'appointments',
        loadComponent: () => import('./features/patient/appointments-page').then((m) => m.AppointmentsPage),
        title: 'Appointments — MediCare360',
      },
      {
        path: 'appointments/:appointmentId',
        loadComponent: () =>
          import('./features/shared-pages/appointment-detail-page').then((m) => m.AppointmentDetailPage),
        title: 'Appointment — MediCare360',
      },
      {
        path: 'prescriptions',
        loadComponent: () => import('./features/patient/prescriptions-page').then((m) => m.PrescriptionsPage),
        title: 'Prescriptions — MediCare360',
      },
      {
        path: 'prescriptions/:prescriptionId',
        loadComponent: () =>
          import('./features/shared-pages/prescription-detail-page').then((m) => m.PrescriptionDetailPage),
        title: 'Prescription — MediCare360',
      },
      {
        path: 'records',
        loadComponent: () => import('./features/patient/records-page').then((m) => m.RecordsPage),
        title: 'Medical history — MediCare360',
      },
      {
        path: 'records/:recordId',
        loadComponent: () => import('./features/patient/record-detail-page').then((m) => m.RecordDetailPage),
        title: 'Visit record — MediCare360',
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/patient/reports-page').then((m) => m.ReportsPage),
        title: 'Lab reports — MediCare360',
      },
      {
        path: 'reports/:reportId',
        loadComponent: () => import('./features/shared-pages/report-detail-page').then((m) => m.ReportDetailPage),
        title: 'Report — MediCare360',
      },

      /* Pharmacy. The literal paths come before `:medicineId` so a medicine
         id can never shadow the cart or the order list. */
      {
        path: 'pharmacy',
        loadComponent: () => import('./features/pharmacy/catalogue-page').then((m) => m.CataloguePage),
        title: 'Medical store — MediCare360',
      },
      {
        path: 'pharmacy/cart',
        loadComponent: () => import('./features/pharmacy/cart-page').then((m) => m.CartPage),
        title: 'Your basket — MediCare360',
      },
      {
        path: 'pharmacy/checkout',
        loadComponent: () => import('./features/pharmacy/checkout-page').then((m) => m.CheckoutPage),
        title: 'Checkout — MediCare360',
      },
      {
        path: 'pharmacy/orders',
        loadComponent: () => import('./features/pharmacy/orders-page').then((m) => m.OrdersPage),
        title: 'Medicine orders — MediCare360',
      },
      {
        path: 'pharmacy/orders/:orderId',
        loadComponent: () => import('./features/pharmacy/order-detail-page').then((m) => m.OrderDetailPage),
        title: 'Order — MediCare360',
      },
      {
        path: 'pharmacy/:medicineId',
        loadComponent: () => import('./features/pharmacy/medicine-page').then((m) => m.MedicinePage),
        title: 'Medicine — MediCare360',
      },

      {
        path: 'pay/:paymentId',
        loadComponent: () => import('./features/shared-pages/payment-page').then((m) => m.PaymentPage),
        title: 'Payment — MediCare360',
      },
      {
        path: 'payments',
        loadComponent: () => import('./features/patient/payments-page').then((m) => m.PaymentsPage),
        title: 'Payments — MediCare360',
      },
      {
        path: 'payments/:paymentId',
        loadComponent: () => import('./features/shared-pages/receipt-page').then((m) => m.ReceiptPage),
        title: 'Receipt — MediCare360',
      },

      {
        path: 'family',
        loadComponent: () => import('./features/patient/family-page').then((m) => m.FamilyPage),
        title: 'Family members — MediCare360',
      },
      {
        path: 'emergency',
        loadComponent: () => import('./features/patient/emergency-page').then((m) => m.EmergencyPage),
        title: 'Emergency card — MediCare360',
      },
      {
        path: 'qr',
        loadComponent: () => import('./features/shared-pages/qr-page').then((m) => m.QrPage),
        title: 'Scan a code — MediCare360',
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/shared-pages/notifications-page').then((m) => m.NotificationsPage),
        title: 'Notifications — MediCare360',
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/patient/profile-page').then((m) => m.PatientProfilePage),
        title: 'Your profile — MediCare360',
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/shared-pages/settings-page').then((m) => m.SettingsPage),
        title: 'Appearance & security — MediCare360',
      },
    ],
  },

  /* -------------------------------------------------------- doctor panel */

  {
    path: 'doctor',
    canActivate: [roleGuard('doctor')],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    data: { panel: 'doctor' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/doctor/dashboard-page').then((m) => m.DoctorDashboardPage),
        title: 'Doctor dashboard — MediCare360',
      },
      {
        path: 'queue',
        loadComponent: () => import('./features/doctor/queue-page').then((m) => m.QueuePage),
        title: "Today's queue — MediCare360",
      },
      {
        path: 'appointments',
        loadComponent: () => import('./features/doctor/appointments-page').then((m) => m.DoctorAppointmentsPage),
        title: 'Appointments — MediCare360',
      },
      {
        path: 'appointments/:appointmentId',
        loadComponent: () =>
          import('./features/shared-pages/appointment-detail-page').then((m) => m.AppointmentDetailPage),
        title: 'Appointment — MediCare360',
      },
      {
        path: 'patients',
        loadComponent: () => import('./features/doctor/patients-page').then((m) => m.DoctorPatientsPage),
        title: 'Patients — MediCare360',
      },
      {
        path: 'patients/:patientId',
        loadComponent: () =>
          import('./features/shared-pages/patient-record-page').then((m) => m.PatientRecordPage),
        title: 'Patient — MediCare360',
      },
      {
        path: 'consultation/:appointmentId',
        loadComponent: () => import('./features/doctor/consultation-page').then((m) => m.ConsultationPage),
        title: 'Consultation — MediCare360',
      },
      {
        path: 'prescriptions',
        loadComponent: () => import('./features/doctor/prescriptions-page').then((m) => m.DoctorPrescriptionsPage),
        title: 'Prescriptions issued — MediCare360',
      },
      {
        path: 'prescriptions/:prescriptionId',
        loadComponent: () =>
          import('./features/shared-pages/prescription-detail-page').then((m) => m.PrescriptionDetailPage),
        title: 'Prescription — MediCare360',
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/doctor/reports-page').then((m) => m.DoctorReportsPage),
        title: 'Lab reports & tests — MediCare360',
      },
      {
        path: 'reports/:reportId',
        loadComponent: () => import('./features/shared-pages/report-detail-page').then((m) => m.ReportDetailPage),
        title: 'Report — MediCare360',
      },
      {
        path: 'availability',
        loadComponent: () => import('./features/doctor/availability-page').then((m) => m.AvailabilityPage),
        title: 'Availability & leave — MediCare360',
      },
      {
        path: 'earnings',
        loadComponent: () => import('./features/doctor/earnings-page').then((m) => m.EarningsPage),
        title: 'Earnings — MediCare360',
      },
      {
        path: 'qr',
        loadComponent: () => import('./features/shared-pages/qr-page').then((m) => m.QrPage),
        title: 'Scan a code — MediCare360',
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/shared-pages/notifications-page').then((m) => m.NotificationsPage),
        title: 'Notifications — MediCare360',
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/doctor/profile-page').then((m) => m.DoctorProfilePage),
        title: 'Your profile — MediCare360',
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/shared-pages/settings-page').then((m) => m.SettingsPage),
        title: 'Appearance & security — MediCare360',
      },
    ],
  },

  /* -------------------------------------------------- reception / admin */

  {
    path: 'admin',
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    data: { panel: 'admin' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard-page').then((m) => m.AdminDashboardPage),
        title: 'Reception dashboard — MediCare360',
      },
      {
        path: 'appointments',
        loadComponent: () => import('./features/admin/appointments-page').then((m) => m.AdminAppointmentsPage),
        title: 'Appointments — MediCare360',
      },
      {
        path: 'appointments/:appointmentId',
        loadComponent: () =>
          import('./features/shared-pages/appointment-detail-page').then((m) => m.AppointmentDetailPage),
        title: 'Appointment — MediCare360',
      },
      {
        path: 'register',
        loadComponent: () => import('./features/admin/register-patient-page').then((m) => m.RegisterPatientPage),
        title: 'Register a patient — MediCare360',
      },
      {
        path: 'patients',
        loadComponent: () => import('./features/admin/patients-page').then((m) => m.AdminPatientsPage),
        title: 'Patients — MediCare360',
      },
      {
        path: 'patients/:patientId',
        loadComponent: () =>
          import('./features/shared-pages/patient-record-page').then((m) => m.PatientRecordPage),
        title: 'Patient — MediCare360',
      },
      {
        path: 'doctors',
        loadComponent: () => import('./features/admin/doctors-page').then((m) => m.AdminDoctorsPage),
        title: 'Doctors — MediCare360',
      },
      {
        path: 'departments',
        loadComponent: () => import('./features/admin/departments-page').then((m) => m.AdminDepartmentsPage),
        title: 'Departments & branches — MediCare360',
      },
      {
        path: 'payments',
        loadComponent: () => import('./features/admin/payments-page').then((m) => m.AdminPaymentsPage),
        title: 'Payments — MediCare360',
      },
      {
        path: 'payments/:paymentId',
        loadComponent: () => import('./features/shared-pages/receipt-page').then((m) => m.ReceiptPage),
        title: 'Receipt — MediCare360',
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/pharmacy/queue-page').then((m) => m.PharmacyQueuePage),
        title: 'Pharmacy orders — MediCare360',
      },
      {
        path: 'orders/:orderId',
        loadComponent: () => import('./features/pharmacy/order-detail-page').then((m) => m.OrderDetailPage),
        title: 'Order — MediCare360',
      },
      {
        path: 'prescriptions/:prescriptionId',
        loadComponent: () =>
          import('./features/shared-pages/prescription-detail-page').then((m) => m.PrescriptionDetailPage),
        title: 'Prescription — MediCare360',
      },
      {
        path: 'reports/:reportId',
        loadComponent: () => import('./features/shared-pages/report-detail-page').then((m) => m.ReportDetailPage),
        title: 'Report — MediCare360',
      },
      {
        path: 'qr',
        loadComponent: () => import('./features/shared-pages/qr-page').then((m) => m.QrPage),
        title: 'Scan a code — MediCare360',
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/shared-pages/notifications-page').then((m) => m.NotificationsPage),
        title: 'Notifications — MediCare360',
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/shared-pages/settings-page').then((m) => m.SettingsPage),
        title: 'Appearance & security — MediCare360',
      },
    ],
  },

  /* ------------------------------------------------------ pharmacy desk */

  {
    path: 'pharmacy',
    canActivate: [roleGuard('pharmacy')],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    data: { panel: 'pharmacy' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/pharmacy/dashboard-page').then((m) => m.PharmacyDashboardPage),
        title: 'Pharmacy dashboard — MediCare360',
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/pharmacy/queue-page').then((m) => m.PharmacyQueuePage),
        title: 'Dispensing queue — MediCare360',
      },
      {
        path: 'orders/:orderId',
        loadComponent: () => import('./features/pharmacy/order-detail-page').then((m) => m.OrderDetailPage),
        title: 'Order — MediCare360',
      },
      {
        path: 'verify',
        loadComponent: () => import('./features/pharmacy/verify-page').then((m) => m.VerifyPrescriptionPage),
        title: 'Verify a prescription — MediCare360',
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/pharmacy/inventory-page').then((m) => m.InventoryPage),
        title: 'Inventory — MediCare360',
      },
      {
        path: 'catalogue',
        loadComponent: () => import('./features/pharmacy/catalogue-page').then((m) => m.CataloguePage),
        title: 'Catalogue — MediCare360',
      },
      {
        path: 'catalogue/:medicineId',
        loadComponent: () => import('./features/pharmacy/medicine-page').then((m) => m.MedicinePage),
        title: 'Medicine — MediCare360',
      },
      {
        path: 'prescriptions/:prescriptionId',
        loadComponent: () =>
          import('./features/shared-pages/prescription-detail-page').then((m) => m.PrescriptionDetailPage),
        title: 'Prescription — MediCare360',
      },
      {
        path: 'qr',
        loadComponent: () => import('./features/shared-pages/qr-page').then((m) => m.QrPage),
        title: 'Scan a code — MediCare360',
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/shared-pages/notifications-page').then((m) => m.NotificationsPage),
        title: 'Notifications — MediCare360',
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/shared-pages/settings-page').then((m) => m.SettingsPage),
        title: 'Appearance & security — MediCare360',
      },
    ],
  },

  /* Anything else, signed in or not, lands on a page that offers a way back. */
  {
    path: '**',
    canActivate: [authGuard],
    loadComponent: () => import('./features/misc/not-found-page').then((m) => m.NotFoundPage),
    title: 'Page not found — MediCare360',
  },
];
