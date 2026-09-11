import { Router } from 'express';
import { store } from '../db/store.js';
import { ymd } from '../lib/ids.js';
import { forbidden } from '../lib/http-error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/**
 * Dashboard aggregates.
 *
 * Charts are computed server-side so every client gets the same numbers, and so
 * a dashboard is one request rather than "fetch everything, then count it in
 * the browser".
 */
export const statsRoutes = Router();

statsRoutes.use(requireAuth);

/** Everything the doctor dashboard shows: counts, charts and earnings. */
statsRoutes.get('/doctor/:doctorId', requireRole('doctor', 'admin'), (req, res) => {
  const { doctorId } = req.params;

  if (req.auth.role === 'doctor' && req.auth.profileId !== doctorId) {
    throw forbidden('You can only read your own dashboard.');
  }

  const doctor = store.findOrFail('doctors', doctorId);
  const today = ymd();
  const appointments = store.filter('appointments', (row) => row.doctorId === doctorId);
  const todays = appointments.filter((row) => row.date === today);

  const payments = store.filter(
    'payments',
    (row) => row.doctorId === doctorId && row.kind === 'consultation',
  );
  const settled = payments.filter((row) => row.status === 'successful');

  const earnedOn = (predicate) =>
    settled.filter((row) => predicate(row.paidAt?.slice(0, 10) ?? '')).reduce((sum, row) => sum + row.amount, 0);

  const monthPrefix = today.slice(0, 7);
  const weekStart = shiftDate(today, -6);

  return res.json({
    doctor: { id: doctor.id, name: doctor.name, departmentName: doctor.departmentName },
    today: {
      total: todays.length,
      waiting: todays.filter((row) => row.queueStatus === 'waiting').length,
      inConsultation: todays.filter((row) => row.queueStatus === 'in-consultation').length,
      completed: todays.filter((row) => row.status === 'completed').length,
      cancelled: todays.filter((row) => row.status === 'cancelled').length,
      noShow: todays.filter((row) => row.status === 'no-show').length,
    },
    totals: {
      patients: new Set(appointments.map((row) => row.patientId)).size,
      newThisMonth: new Set(
        appointments.filter((row) => row.date.startsWith(monthPrefix) && row.visitType === 'new').map((row) => row.patientId),
      ).size,
      consultations: appointments.filter((row) => row.status === 'completed').length,
      prescriptions: store.filter('prescriptions', (row) => row.doctorId === doctorId).length,
      followUps: store.filter(
        'consultations',
        (row) => row.doctorId === doctorId && row.followUpDate && row.followUpDate >= today,
      ).length,
      pendingReports: store.filter(
        'testRequests',
        (row) => row.doctorId === doctorId && row.status !== 'report-available',
      ).length,
    },
    earnings: {
      today: earnedOn((date) => date === today),
      week: earnedOn((date) => date >= weekStart && date <= today),
      month: earnedOn((date) => date.startsWith(monthPrefix)),
      lifetime: settled.reduce((sum, row) => sum + row.amount, 0),
      pending: payments
        .filter((row) => row.status === 'pending')
        .reduce((sum, row) => sum + row.amount, 0),
      paidCount: settled.length,
      pendingCount: payments.filter((row) => row.status === 'pending').length,
    },
    charts: {
      // Fourteen days of appointment volume — the shape of a working fortnight.
      daily: lastDays(14).map((date) => ({
        label: date.slice(5),
        date,
        value: appointments.filter((row) => row.date === date).length,
      })),
      monthly: lastMonths(6).map((month) => ({
        label: monthLabel(month),
        value: appointments.filter((row) => row.date.startsWith(month)).length,
      })),
      revenue: lastMonths(6).map((month) => ({
        label: monthLabel(month),
        value: settled
          .filter((row) => (row.paidAt ?? '').startsWith(month))
          .reduce((sum, row) => sum + row.amount, 0),
      })),
      status: ['completed', 'confirmed', 'cancelled', 'no-show', 'pending'].map((status) => ({
        label: status,
        value: appointments.filter((row) => row.status === status).length,
      })),
    },
  });
});

/** The patient dashboard's small numbers: spend, visits and upcoming care. */
statsRoutes.get('/patient/:patientId', (req, res) => {
  const { patientId } = req.params;

  if (req.auth.role === 'patient' && req.auth.profileId !== patientId) {
    throw forbidden('You can only read your own dashboard.');
  }

  store.findOrFail('patients', patientId);

  const today = ymd();
  const appointments = store.filter('appointments', (row) => row.patientId === patientId);
  const payments = store.filter(
    'payments',
    (row) => row.patientId === patientId && row.status === 'successful',
  );

  res.json({
    visits: appointments.filter((row) => row.status === 'completed').length,
    upcoming: appointments.filter(
      (row) => row.date >= today && ['pending', 'confirmed', 'checked-in'].includes(row.status),
    ).length,
    prescriptions: store.filter('prescriptions', (row) => row.patientId === patientId).length,
    reports: store.filter('medicalReports', (row) => row.patientId === patientId).length,
    spent: payments.reduce((sum, row) => sum + row.amount, 0),
    charts: {
      spendByMonth: lastMonths(6).map((month) => ({
        label: monthLabel(month),
        value: payments
          .filter((row) => (row.paidAt ?? '').startsWith(month))
          .reduce((sum, row) => sum + row.amount, 0),
      })),
      visitsByDepartment: Object.entries(
        appointments
          .filter((row) => row.status === 'completed')
          .reduce((counts, row) => {
            counts[row.departmentName] = (counts[row.departmentName] ?? 0) + 1;
            return counts;
          }, {}),
      )
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    },
  });
});

/**
 * Hospital-wide figures for the reception desk.
 *
 * Reception's job is the day in front of them: who is expected, who has not
 * arrived, what is unpaid, and which departments are busy. So the numbers lean
 * on today rather than on lifetime totals.
 */
statsRoutes.get('/hospital', requireRole('admin'), (_req, res) => {
  const today = ymd();
  const monthPrefix = today.slice(0, 7);

  const appointments = store.collection('appointments');
  const todays = appointments.filter((row) => row.date === today);
  const payments = store.collection('payments');

  const settledOn = (predicate) =>
    payments
      .filter((row) => row.status === 'successful' && predicate(row.paidAt ?? ''))
      .reduce((sum, row) => sum + row.amount, 0);

  // Which departments are actually busy today, biggest first.
  const byDepartment = Object.entries(
    todays.reduce((counts, row) => {
      counts[row.departmentName] = (counts[row.departmentName] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  res.json({
    totals: {
      patients: store.collection('patients').length,
      doctors: store.collection('doctors').length,
      departments: store.collection('departments').length,
      branches: store.collection('hospitalBranches').length,
      registeredThisMonth: store.filter('patients', (row) =>
        (row.registeredAt ?? '').startsWith(monthPrefix),
      ).length,
    },
    today: {
      expected: todays.length,
      checkedIn: todays.filter((row) => row.token !== null && row.token !== undefined).length,
      waiting: todays.filter((row) => row.queueStatus === 'waiting').length,
      inConsultation: todays.filter((row) => row.queueStatus === 'in-consultation').length,
      completed: todays.filter((row) => row.status === 'completed').length,
      cancelled: todays.filter((row) => row.status === 'cancelled').length,
      noShow: todays.filter((row) => row.status === 'no-show').length,
      notArrived: todays.filter((row) => row.status === 'confirmed' && !row.token).length,
      doctorsOnDuty: new Set(todays.map((row) => row.doctorId)).size,
    },
    money: {
      revenueToday: settledOn((date) => date.startsWith(today)),
      revenueMonth: settledOn((date) => date.startsWith(monthPrefix)),
      unpaidCount: payments.filter((row) => row.status === 'pending').length,
      unpaidValue: payments
        .filter((row) => row.status === 'pending')
        .reduce((sum, row) => sum + row.amount, 0),
      refundedMonth: payments.filter(
        (row) => row.status === 'refunded' && (row.createdAt ?? '').startsWith(monthPrefix),
      ).length,
    },
    pharmacy: {
      openOrders: store.filter(
        'medicineOrders',
        (row) => row.stage !== 'delivered' && row.stage !== 'cancelled',
      ).length,
      lowStock: store.filter('medicines', (row) => row.stock > 0 && row.stock < 25).length,
      outOfStock: store.filter('medicines', (row) => row.stock === 0).length,
    },
    charts: {
      byDepartment: byDepartment.slice(0, 6),
      daily: lastDays(14).map((date) => ({
        label: date.slice(5),
        date,
        value: appointments.filter((row) => row.date === date).length,
      })),
      revenue: lastMonths(6).map((month) => ({
        label: monthLabel(month),
        value: settledOn((date) => date.startsWith(month)),
      })),
    },
    onLeave: store.filter(
      'doctorLeaves',
      (row) => row.status === 'approved' && today >= row.from && today <= row.to,
    ).length,
  });
});

/**
 * The pharmacy counter's own numbers: what is queued to dispense, and what is
 * about to run out or expire.
 */
statsRoutes.get('/pharmacy', requireRole('pharmacy', 'admin'), (_req, res) => {
  const today = ymd();
  const monthPrefix = today.slice(0, 7);

  const orders = store.collection('medicineOrders');
  const medicines = store.collection('medicines');

  const stage = (name) => orders.filter((row) => row.stage === name).length;

  // Anything expiring inside 90 days is a stock decision, not a surprise.
  const soon = shiftDate(today, 90);

  res.json({
    queue: {
      placed: stage('placed'),
      confirmed: stage('confirmed'),
      preparing: stage('preparing'),
      readyForPickup: stage('ready-for-pickup'),
      outForDelivery: stage('out-for-delivery'),
      deliveredToday: orders.filter(
        (row) => row.stage === 'delivered' && (row.placedAt ?? '').startsWith(today),
      ).length,
      awaitingPayment: orders.filter((row) => row.paymentStatus === 'pending').length,
      needsPrescription: orders.filter((row) => row.prescriptionStatus === 'required').length,
    },
    inventory: {
      lines: medicines.length,
      outOfStock: medicines.filter((row) => row.stock === 0).length,
      lowStock: medicines.filter((row) => row.stock > 0 && row.stock < 25).length,
      expiringSoon: medicines.filter((row) => row.expiryDate <= soon).length,
      stockValue: medicines.reduce((sum, row) => sum + row.price * row.stock, 0),
    },
    money: {
      revenueToday: store
        .filter(
          'payments',
          (row) =>
            row.kind === 'pharmacy' &&
            row.status === 'successful' &&
            (row.paidAt ?? '').startsWith(today),
        )
        .reduce((sum, row) => sum + row.amount, 0),
      revenueMonth: store
        .filter(
          'payments',
          (row) =>
            row.kind === 'pharmacy' &&
            row.status === 'successful' &&
            (row.paidAt ?? '').startsWith(monthPrefix),
        )
        .reduce((sum, row) => sum + row.amount, 0),
    },
    charts: {
      revenue: lastMonths(6).map((month) => ({
        label: monthLabel(month),
        value: store
          .filter(
            'payments',
            (row) =>
              row.kind === 'pharmacy' &&
              row.status === 'successful' &&
              (row.paidAt ?? '').startsWith(month),
          )
          .reduce((sum, row) => sum + row.amount, 0),
      })),
      byCategory: store
        .collection('medicineCategories')
        .map((category) => ({
          label: category.name,
          value: medicines.filter((row) => row.category === category.id && row.stock === 0).length,
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    },
  });
});

/* ---------------------------------------------------------------- helpers */

function shiftDate(date, days) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return ymd(next);
}

function lastDays(count) {
  const today = ymd();
  return Array.from({ length: count }, (_value, index) => shiftDate(today, index - count + 1));
}

function lastMonths(count) {
  const now = new Date();

  return Array.from({ length: count }, (_value, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

function monthLabel(month) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });
}
