import { Router } from 'express';
import { store } from '../db/store.js';
import { prettyDate } from '../lib/dates.js';
import { badRequest, forbidden } from '../lib/http-error.js';
import { notify, notifyBoth } from '../lib/notify.js';
import { listQuery } from '../lib/query.js';
import { validate } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Mock payments.
 *
 * No money moves. What is real is the bookkeeping around it: a payment exists
 * from the moment something is ordered, it settles or fails as one step, and
 * whatever it is attached to — an appointment, a pharmacy order — is updated in
 * the same request. Nothing else in the app is allowed to mark itself paid.
 */
export const paymentRoutes = Router();

paymentRoutes.use(requireAuth);

export const PAYMENT_METHODS = ['upi', 'credit-card', 'debit-card', 'net-banking', 'wallet', 'insurance'];

paymentRoutes.get('/', (req, res) => {
  let rows = store.collection('payments');

  if (req.auth.role === 'patient') rows = rows.filter((row) => row.patientId === req.auth.profileId);
  // A doctor sees the consultations they were paid for, not the patient's
  // pharmacy spending.
  if (req.auth.role === 'doctor') {
    rows = rows.filter((row) => row.doctorId === req.auth.profileId && row.kind === 'consultation');
  }

  res.json(
    listQuery(rows, req.query, {
      filterable: ['status', 'kind', 'method', 'patientId', 'doctorId'],
      searchable: ['id', 'transactionId', 'referenceId'],
      defaultSort: '-createdAt',
    }),
  );
});

paymentRoutes.get('/:id', (req, res) => {
  const payment = readable(req, req.params.id);

  res.json({
    ...payment,
    patient: store.find('patients', payment.patientId),
    doctor: payment.doctorId ? store.find('doctors', payment.doctorId) : null,
    appointment: payment.kind === 'consultation' ? store.find('appointments', payment.referenceId) : null,
    order: payment.kind === 'pharmacy' ? store.find('medicineOrders', payment.referenceId) : null,
  });
});

/**
 * Settles a payment.
 *
 * The outcome is decided here, not by the client: a `simulate` flag lets the
 * demo show a declined card, and everything downstream — appointment status,
 * order status, notifications — follows from the result.
 */
paymentRoutes.post('/:id/pay', (req, res) => {
  const payment = readable(req, req.params.id);

  if (payment.status === 'successful') throw badRequest('That payment has already gone through.');
  if (payment.status === 'refunded') throw badRequest('That payment was refunded.');

  const input = validate(req.body, {
    method: { required: true, oneOf: PAYMENT_METHODS },
    simulate: { default: 'success', oneOf: ['success', 'failure'] },
    reference: { default: '' },
  });

  if (input.simulate === 'failure') {
    const failed = store.update('payments', payment.id, {
      status: 'failed',
      method: input.method,
      failureReason: 'The bank declined this transaction.',
    });

    notify({
      ownerId: payment.patientId,
      audience: 'patient',
      kind: 'payment',
      title: 'Payment failed',
      body: `₹${payment.amount} could not be charged. Try another method.`,
      link: `/patient/payments/${payment.id}`,
    });

    return res.status(402).json({ payment: failed, error: { status: 402, message: 'The bank declined this transaction.' } });
  }

  const settled = store.update('payments', payment.id, {
    status: 'successful',
    method: input.method,
    transactionId: `TXN${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 90 + 10)}`,
    reference: input.reference || null,
    paidAt: new Date().toISOString(),
    failureReason: null,
  });

  if (payment.kind === 'consultation') confirmAppointment(payment, settled);
  if (payment.kind === 'pharmacy') confirmOrder(payment);

  res.json({ payment: settled });
});

/** Everything a printable receipt needs, in one response. */
paymentRoutes.get('/:id/receipt', (req, res) => {
  const payment = readable(req, req.params.id);
  const patient = store.find('patients', payment.patientId);
  const appointment = payment.kind === 'consultation' ? store.find('appointments', payment.referenceId) : null;
  const order = payment.kind === 'pharmacy' ? store.find('medicineOrders', payment.referenceId) : null;

  res.json({
    receiptNo: payment.id.replace('PAY-', 'RCPT-'),
    issuedAt: payment.paidAt ?? payment.createdAt,
    status: payment.status,
    transactionId: payment.transactionId,
    method: payment.method,
    amount: payment.amount,
    breakdown: payment.breakdown,
    billedTo: patient
      ? { id: patient.id, name: patient.name, email: patient.email, mobile: patient.mobile }
      : null,
    branch: store.find('hospitalBranches', patient?.preferredBranchId ?? 'BR-000001'),
    lines: appointment
      ? [
          {
            label: `${appointment.visitType === 'follow-up' ? 'Follow-up' : 'Consultation'} — ${appointment.doctorName}`,
            detail: `${appointment.departmentName} · ${prettyDate(appointment.date)} at ${appointment.time}`,
            amount: appointment.fee,
          },
        ]
      : (order?.lines ?? []).map((line) => ({
          label: `${line.name} ${line.strength}`,
          detail: `${line.quantity} × ₹${line.price}`,
          amount: line.price * line.quantity,
        })),
  });
});

/** A booking that has been paid for is a confirmed booking. */
function confirmAppointment(payment, settled) {
  const appointment = store.find('appointments', payment.referenceId);
  if (!appointment) return;

  store.update('appointments', appointment.id, {
    status: appointment.status === 'pending' ? 'confirmed' : appointment.status,
    paymentStatus: 'successful',
  });

  notifyBoth({
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    kind: 'appointment',
    patient: {
      title: 'Appointment confirmed',
      body: `${appointment.doctorName} · ${prettyDate(appointment.date)} at ${appointment.time}. Paid ₹${settled.amount}.`,
      link: `/patient/appointments/${appointment.id}`,
    },
    doctor: {
      title: 'New appointment',
      body: `${appointment.patientName} · ${prettyDate(appointment.date)} at ${appointment.time}.`,
      link: `/doctor/appointments/${appointment.id}`,
    },
  });
}

function confirmOrder(payment) {
  const order = store.find('medicineOrders', payment.referenceId);
  if (!order) return;

  store.update('medicineOrders', order.id, {
    paymentStatus: 'successful',
    stage: 'confirmed',
    timeline: [...order.timeline, { stage: 'confirmed', at: new Date().toISOString() }],
  });

  notify({
    ownerId: order.patientId,
    audience: 'patient',
    kind: 'order',
    title: 'Order confirmed',
    body: `Order ${order.id} · ₹${order.bill.total}. The pharmacy is packing it now.`,
    link: `/patient/pharmacy/orders/${order.id}`,
  });
}

function readable(req, id) {
  const payment = store.findOrFail('payments', id, `No payment matches "${id}".`);
  const { role, profileId } = req.auth;

  if (role === 'patient' && payment.patientId !== profileId) {
    throw forbidden('That payment belongs to another account.');
  }
  if (role === 'doctor' && payment.doctorId !== profileId) {
    throw forbidden('That payment is not yours to view.');
  }

  return payment;
}
