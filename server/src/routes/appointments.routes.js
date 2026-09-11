import { Router } from 'express';
import { store } from '../db/store.js';
import { billFor, discountFor } from '../lib/billing.js';
import { addMinutes, prettyDate } from '../lib/dates.js';
import { badRequest, conflict, forbidden } from '../lib/http-error.js';
import { nextId, ymd } from '../lib/ids.js';
import { notify, notifyBoth } from '../lib/notify.js';
import { listQuery } from '../lib/query.js';
import { slotIsFree, slotsFor } from '../lib/slots.js';
import { validate } from '../lib/validate.js';
import { visiblePatient } from '../lib/visibility.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/** Booking, rescheduling, cancelling, and the live clinic queue. */
export const appointmentRoutes = Router();

appointmentRoutes.use(requireAuth);

/** Every status an appointment can hold, in the order it normally moves. */
export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'checked-in',
  'in-consultation',
  'completed',
  'cancelled',
  'rescheduled',
  'no-show',
];

/**
 * Narrows a collection to what the caller is allowed to see.
 *
 * Applied before any filter in the query string, so a patient cannot widen
 * their own view by passing `?patientId=` for somebody else.
 */
function scopeFor(req, rows, { patientKey = 'patientId', doctorKey = 'doctorId' } = {}) {
  if (req.auth.role === 'patient') return rows.filter((row) => row[patientKey] === req.auth.profileId);
  if (req.auth.role === 'doctor') return rows.filter((row) => row[doctorKey] === req.auth.profileId);
  return rows;
}

appointmentRoutes.get('/', (req, res) => {
  let rows = scopeFor(req, store.collection('appointments'));

  const { from, to, upcoming, past } = req.query;
  const today = ymd();

  if (from) rows = rows.filter((row) => row.date >= String(from));
  if (to) rows = rows.filter((row) => row.date <= String(to));
  if (upcoming === 'true') {
    rows = rows.filter(
      (row) => row.date >= today && ['pending', 'confirmed', 'checked-in', 'in-consultation'].includes(row.status),
    );
  }
  if (past === 'true') rows = rows.filter((row) => row.date < today || row.status === 'completed');

  res.json(
    listQuery(rows, req.query, {
      filterable: ['status', 'departmentId', 'doctorId', 'patientId', 'date', 'consultationType', 'branchId'],
      searchable: ['id', 'patientName', 'doctorName', 'departmentName', 'reason'],
      defaultSort: '-date',
    }),
  );
});

appointmentRoutes.get('/:id', (req, res) => {
  const appointment = readable(req, req.params.id);

  res.json({
    ...appointment,
    patient: visiblePatient(store.find('patients', appointment.patientId), req.auth.role),
    doctor: store.find('doctors', appointment.doctorId),
    branch: store.find('hospitalBranches', appointment.branchId),
    payment: store.find('payments', appointment.paymentId),
    consultation: appointment.consultationId ? store.find('consultations', appointment.consultationId) : null,
    prescription: store.findBy('prescriptions', (row) => row.appointmentId === appointment.id),
    reports: store.filter('medicalReports', (row) => row.appointmentId === appointment.id),
  });
});

/**
 * Books a slot.
 *
 * The request names a doctor, a date and a time; the server re-checks the slot
 * against live data and prices the visit itself. Two patients racing for the
 * same 10:30 means the second one gets a 409, not a double booking.
 */
appointmentRoutes.post('/', (req, res) => {
  const input = validate(req.body, {
    doctorId: { required: true },
    date: { type: 'date', required: true },
    time: { required: true, pattern: /^\d{2}:\d{2}$/, message: 'Pick a time slot.' },
    reason: { required: true, minLength: 5, message: 'Tell the doctor why you are coming in.' },
    consultationType: { default: 'in-person', oneOf: ['in-person', 'online'] },
    patientId: {},
    familyMemberId: {},
    couponCode: { default: '' },
    symptoms: { type: 'array', default: [] },
  });

  // Staff can book on a patient's behalf at the reception desk; a patient can
  // only ever book for themselves.
  const patientId = req.auth.role === 'patient' ? req.auth.profileId : input.patientId;
  if (!patientId) throw badRequest('Which patient is this for?', { patientId: 'Select a patient.' });

  const patient = store.findOrFail('patients', patientId);
  const doctor = store.findOrFail('doctors', input.doctorId);

  if (input.date < ymd()) throw badRequest('That date has already passed.');
  if (input.consultationType === 'online' && !doctor.acceptsOnline) {
    throw badRequest(`${doctor.name} does not take online consultations.`);
  }

  if (!slotIsFree(doctor.id, input.date, input.time)) {
    throw conflict('That slot was just taken. Pick another time.');
  }

  // A visit within 30 days of a completed one with the same doctor is a
  // follow-up, and priced as one.
  const recent = store.filter(
    'appointments',
    (row) => row.patientId === patientId && row.doctorId === doctor.id && row.status === 'completed',
  );
  const isFollowUp = recent.some((row) => daysBetween(row.date, input.date) <= 30);
  const fee = isFollowUp ? doctor.followUpFee : doctor.consultationFee;

  const coupon = input.couponCode
    ? store.findBy(
        'coupons',
        (row) => row.code === input.couponCode.toUpperCase() && row.appliesTo === 'consultation',
      )
    : null;

  if (input.couponCode && !coupon) {
    throw badRequest('That coupon is not valid for a consultation.', { couponCode: 'Unknown coupon code.' });
  }

  const breakdown = billFor(fee, patient.insuranceProvider, discountFor(coupon, fee));
  const appointmentId = nextId('appointment', { dated: true, date: new Date(`${input.date}T00:00:00`) });

  // The payment row exists from the moment the booking does, in `pending`. The
  // payment screen settles it; nothing has to invent a record later.
  const payment = store.insert('payments', {
    id: nextId('payment'),
    transactionId: null,
    kind: 'consultation',
    referenceId: appointmentId,
    patientId,
    doctorId: doctor.id,
    amount: breakdown.total,
    breakdown,
    couponCode: coupon?.code ?? null,
    method: null,
    status: 'pending',
    paidAt: null,
    createdAt: new Date().toISOString(),
  });

  const appointment = store.insert('appointments', {
    id: appointmentId,
    patientId,
    patientName: patient.name,
    familyMemberId: input.familyMemberId || null,
    doctorId: doctor.id,
    doctorName: doctor.name,
    departmentId: doctor.departmentId,
    departmentName: doctor.departmentName,
    branchId: doctor.branchIds[0],
    date: input.date,
    time: input.time,
    endTime: addMinutes(input.time, 20),
    consultationType: input.consultationType,
    visitType: isFollowUp ? 'follow-up' : 'new',
    reason: input.reason,
    symptoms: input.symptoms,
    status: 'pending',
    paymentId: payment.id,
    paymentStatus: 'pending',
    fee,
    token: null,
    queueStatus: null,
    checkedInAt: null,
    consultationId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.status(201).json({ appointment, payment });
});

appointmentRoutes.patch('/:id/reschedule', (req, res) => {
  const appointment = readable(req, req.params.id);

  if (['completed', 'cancelled'].includes(appointment.status)) {
    throw badRequest(`A ${appointment.status} appointment cannot be moved.`);
  }

  const input = validate(req.body, {
    date: { type: 'date', required: true },
    time: { required: true, pattern: /^\d{2}:\d{2}$/ },
  });

  if (input.date < ymd()) throw badRequest('That date has already passed.');
  if (!slotIsFree(appointment.doctorId, input.date, input.time)) {
    throw conflict('That slot is no longer free. Pick another time.');
  }

  const updated = store.update('appointments', appointment.id, {
    date: input.date,
    time: input.time,
    endTime: addMinutes(input.time, 20),
    status: 'rescheduled',
    rescheduledFrom: { date: appointment.date, time: appointment.time },
  });

  notifyBoth({
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    kind: 'appointment',
    patient: {
      title: 'Appointment rescheduled',
      body: `${appointment.doctorName} — now ${prettyDate(input.date)} at ${input.time}.`,
      link: `/patient/appointments/${appointment.id}`,
    },
    doctor: {
      title: 'Appointment rescheduled',
      body: `${appointment.patientName} moved to ${prettyDate(input.date)} at ${input.time}.`,
      link: `/doctor/appointments/${appointment.id}`,
    },
  });

  res.json(updated);
});

appointmentRoutes.post('/:id/cancel', (req, res) => {
  const appointment = readable(req, req.params.id);

  if (appointment.status === 'completed') throw badRequest('That visit has already happened.');
  if (appointment.status === 'cancelled') return res.json(appointment);

  const { reason } = validate(req.body ?? {}, { reason: { default: 'Cancelled by the patient.' } });

  // A settled payment becomes a refund rather than disappearing, so the money
  // trail still matches the appointment trail.
  const payment = store.find('payments', appointment.paymentId);
  if (payment && payment.status === 'successful') {
    store.update('payments', payment.id, { status: 'refunded', refundedAt: new Date().toISOString() });
  }

  const updated = store.update('appointments', appointment.id, {
    status: 'cancelled',
    cancelReason: reason,
    cancelledBy: req.auth.role,
    queueStatus: null,
    token: null,
    paymentStatus: payment?.status === 'successful' ? 'refunded' : 'cancelled',
  });

  notifyBoth({
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    kind: 'appointment',
    patient: {
      title: 'Appointment cancelled',
      body: `${appointment.doctorName} on ${prettyDate(appointment.date)}.${
        payment?.status === 'successful' ? ' A refund has been raised.' : ''
      }`,
      link: `/patient/appointments/${appointment.id}`,
    },
    doctor: {
      title: 'Appointment cancelled',
      body: `${appointment.patientName} cancelled ${prettyDate(appointment.date)} at ${appointment.time}.`,
      link: `/doctor/appointments`,
    },
  });

  res.json(updated);
});

/** Arriving at reception. Assigns the day's next token. */
appointmentRoutes.post('/:id/check-in', (req, res) => {
  const appointment = readable(req, req.params.id);

  if (appointment.status !== 'confirmed') {
    throw badRequest(`Only a confirmed appointment can check in — this one is ${appointment.status}.`);
  }
  if (appointment.date !== ymd()) throw badRequest('You can only check in on the day of the visit.');

  const sameClinic = store.filter(
    'appointments',
    (row) => row.doctorId === appointment.doctorId && row.date === appointment.date && row.token,
  );
  const token = sameClinic.reduce((highest, row) => Math.max(highest, row.token), 0) + 1;

  const updated = store.update('appointments', appointment.id, {
    status: 'checked-in',
    queueStatus: 'waiting',
    token,
    checkedInAt: new Date().toISOString(),
  });

  notify({
    ownerId: appointment.doctorId,
    audience: 'doctor',
    kind: 'queue',
    title: 'Patient checked in',
    body: `Token ${token} · ${appointment.patientName} is waiting.`,
    link: '/doctor/queue',
  });

  res.json(updated);
});

/* ------------------------------------------------------------------ queue */

/**
 * Today's clinic for one doctor, ordered the way it is actually called: anyone
 * already in the room first, then waiting patients by token, then everyone the
 * doctor has finished with.
 */
appointmentRoutes.get('/queue/today', (req, res) => {
  const doctorId = req.auth.role === 'doctor' ? req.auth.profileId : String(req.query.doctorId ?? '');
  if (!doctorId) throw badRequest('Pass ?doctorId= to read a queue.');
  if (req.auth.role === 'patient') throw forbidden('The clinic queue is staff-only.');

  const date = String(req.query.date ?? ymd());
  const rank = { 'in-consultation': 0, waiting: 1, called: 1, completed: 2, 'no-show': 3 };

  const items = store
    .filter('appointments', (row) => row.doctorId === doctorId && row.date === date)
    .filter((row) => !['cancelled'].includes(row.status))
    .sort((a, b) => {
      const byStage = (rank[a.queueStatus] ?? 4) - (rank[b.queueStatus] ?? 4);
      return byStage !== 0 ? byStage : (a.token ?? 99) - (b.token ?? 99) || a.time.localeCompare(b.time);
    })
    .map((row) => ({
      ...row,
      patient: visiblePatient(store.find('patients', row.patientId), req.auth.role),
    }));

  res.json({
    date,
    doctorId,
    items,
    counts: {
      waiting: items.filter((row) => row.queueStatus === 'waiting').length,
      called: items.filter((row) => row.queueStatus === 'called').length,
      inConsultation: items.filter((row) => row.queueStatus === 'in-consultation').length,
      completed: items.filter((row) => row.status === 'completed').length,
      noShow: items.filter((row) => row.queueStatus === 'no-show').length,
      expected: items.length,
    },
  });
});

/** Moves one patient through the queue: called → in-consultation → done. */
appointmentRoutes.post('/:id/queue', requireRole('doctor', 'admin'), (req, res) => {
  const appointment = readable(req, req.params.id);

  const { action } = validate(req.body, {
    action: { required: true, oneOf: ['call', 'start', 'complete', 'no-show', 'reset'] },
  });

  const transitions = {
    call: { queueStatus: 'called' },
    start: { queueStatus: 'in-consultation', status: 'in-consultation' },
    complete: { queueStatus: 'completed', status: 'completed' },
    'no-show': { queueStatus: 'no-show', status: 'no-show' },
    reset: { queueStatus: 'waiting' },
  };

  const updated = store.update('appointments', appointment.id, transitions[action]);

  if (action === 'call') {
    notify({
      ownerId: appointment.patientId,
      audience: 'patient',
      kind: 'queue',
      title: 'You are being called',
      body: `Token ${appointment.token ?? ''} — please go in to see ${appointment.doctorName}.`.trim(),
      link: `/patient/appointments/${appointment.id}`,
    });
  }

  res.json(updated);
});

/** Free slots for the doctor a booking is already attached to. */
appointmentRoutes.get('/:id/slots', (req, res) => {
  const appointment = readable(req, req.params.id);
  res.json(slotsFor(appointment.doctorId, String(req.query.date ?? appointment.date)));
});

/* ---------------------------------------------------------------- helpers */

/** Loads an appointment and confirms the caller is on it. */
function readable(req, id) {
  const appointment = store.findOrFail('appointments', id, `No appointment matches "${id}".`);
  const { role, profileId } = req.auth;

  if (role === 'patient' && appointment.patientId !== profileId) {
    throw forbidden('That appointment belongs to another patient.');
  }
  if (role === 'doctor' && appointment.doctorId !== profileId) {
    throw forbidden('That appointment belongs to another doctor.');
  }

  return appointment;
}

function daysBetween(from, to) {
  return Math.abs(
    Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86_400_000),
  );
}
