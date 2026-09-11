import { Router } from 'express';
import { store } from '../db/store.js';
import { discountFor, orderBill } from '../lib/billing.js';
import { badRequest, conflict, forbidden } from '../lib/http-error.js';
import { nextId } from '../lib/ids.js';
import { notify } from '../lib/notify.js';
import { listQuery } from '../lib/query.js';
import { validate } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/** The hospital medical store: pricing a basket, placing orders, tracking them. */
export const pharmacyRoutes = Router();

pharmacyRoutes.use(requireAuth);

export const ORDER_STAGES = [
  'placed',
  'confirmed',
  'preparing',
  'ready-for-pickup',
  'out-for-delivery',
  'delivered',
];

/**
 * Prices a basket without placing an order.
 *
 * The cart screen calls this on every change, so the total a patient sees is
 * always the total the server will charge — including which lines are blocked
 * for want of a valid prescription.
 */
pharmacyRoutes.post('/quote', (req, res) => {
  const input = validate(req.body, {
    lines: { type: 'array', required: true, min: 1 },
    couponCode: { default: '' },
    prescriptionId: { default: '' },
  });

  res.json(priceBasket(req, input));
});

pharmacyRoutes.get('/orders', (req, res) => {
  const rows =
    req.auth.role === 'patient'
      ? store.filter('medicineOrders', (row) => row.patientId === req.auth.profileId)
      : store.collection('medicineOrders');

  res.json(
    listQuery(rows, req.query, {
      filterable: ['stage', 'patientId', 'paymentStatus', 'prescriptionStatus'],
      searchable: ['id', 'patientName'],
      defaultSort: '-placedAt',
    }),
  );
});

pharmacyRoutes.get('/orders/:id', (req, res) => {
  const order = store.findOrFail('medicineOrders', req.params.id);

  if (req.auth.role === 'patient' && order.patientId !== req.auth.profileId) {
    throw forbidden('That order belongs to another account.');
  }

  res.json({
    ...order,
    payment: store.find('payments', order.paymentId),
    prescription: order.prescriptionId ? store.find('prescriptions', order.prescriptionId) : null,
  });
});

/**
 * Places an order.
 *
 * Stock is decremented here rather than at delivery: it is the moment the goods
 * are committed, and it is what stops two patients buying the last strip.
 */
pharmacyRoutes.post('/orders', (req, res) => {
  const input = validate(req.body, {
    lines: { type: 'array', required: true, min: 1 },
    addressId: { required: true },
    couponCode: { default: '' },
    prescriptionId: { default: '' },
    deliverySlot: { default: 'Today, 6 – 9 pm' },
    patientId: {},
  });

  const patientId = req.auth.role === 'patient' ? req.auth.profileId : input.patientId;
  if (!patientId) throw badRequest('Which patient is this for?', { patientId: 'Select a patient.' });

  const patient = store.findOrFail('patients', patientId);
  const address = store.findOrFail('addresses', input.addressId, 'Choose a delivery address.');

  if (address.ownerId !== patientId) throw forbidden('That address belongs to another account.');

  const quote = priceBasket(req, input, patientId);

  if (quote.blocked.length) {
    throw badRequest('Some medicines need a valid prescription.', {
      prescriptionId: quote.blocked.map((line) => line.name).join(', '),
    });
  }

  if (quote.outOfStock.length) {
    throw conflict(`Out of stock: ${quote.outOfStock.map((line) => line.name).join(', ')}.`);
  }

  const orderId = nextId('order');

  for (const line of quote.lines) {
    const medicine = store.find('medicines', line.medicineId);
    store.update('medicines', medicine.id, { stock: medicine.stock - line.quantity });
  }

  const payment = store.insert('payments', {
    id: nextId('payment'),
    transactionId: null,
    kind: 'pharmacy',
    referenceId: orderId,
    patientId,
    doctorId: null,
    amount: quote.bill.total,
    breakdown: quote.bill,
    couponCode: quote.coupon?.code ?? null,
    method: null,
    status: 'pending',
    paidAt: null,
    createdAt: new Date().toISOString(),
  });

  const order = store.insert('medicineOrders', {
    id: orderId,
    patientId,
    patientName: patient.name,
    lines: quote.lines,
    bill: quote.bill,
    address,
    prescriptionId: input.prescriptionId || null,
    prescriptionStatus: quote.prescriptionStatus,
    paymentId: payment.id,
    paymentStatus: 'pending',
    stage: 'placed',
    timeline: [{ stage: 'placed', at: new Date().toISOString() }],
    deliverySlot: input.deliverySlot,
    placedAt: new Date().toISOString(),
  });

  res.status(201).json({ order, payment });
});

/** Moves an order along its stages. Staff only — patients can just cancel. */
pharmacyRoutes.post('/orders/:id/advance', requireRole('pharmacy', 'admin'), (req, res) => {
  const order = store.findOrFail('medicineOrders', req.params.id);

  const next = ORDER_STAGES[ORDER_STAGES.indexOf(order.stage) + 1];
  if (!next) throw badRequest('That order is already delivered.');

  const updated = store.update('medicineOrders', order.id, {
    stage: next,
    timeline: [...order.timeline, { stage: next, at: new Date().toISOString() }],
  });

  notify({
    ownerId: order.patientId,
    audience: 'patient',
    kind: 'order',
    title: `Order ${next.replaceAll('-', ' ')}`,
    body: `Order ${order.id} is now ${next.replaceAll('-', ' ')}.`,
    link: `/patient/pharmacy/orders/${order.id}`,
  });

  res.json(updated);
});

pharmacyRoutes.post('/orders/:id/cancel', (req, res) => {
  const order = store.findOrFail('medicineOrders', req.params.id);

  if (req.auth.role === 'patient' && order.patientId !== req.auth.profileId) {
    throw forbidden('That order belongs to another account.');
  }
  if (['out-for-delivery', 'delivered'].includes(order.stage)) {
    throw badRequest('That order has already left the pharmacy.');
  }

  // Cancelling returns the stock it reserved.
  for (const line of order.lines) {
    const medicine = store.find('medicines', line.medicineId);
    if (medicine) store.update('medicines', medicine.id, { stock: medicine.stock + line.quantity });
  }

  const payment = store.find('payments', order.paymentId);
  if (payment?.status === 'successful') {
    store.update('payments', payment.id, { status: 'refunded', refundedAt: new Date().toISOString() });
  }

  const updated = store.update('medicineOrders', order.id, {
    stage: 'cancelled',
    paymentStatus: payment?.status === 'successful' ? 'refunded' : 'cancelled',
    timeline: [...order.timeline, { stage: 'cancelled', at: new Date().toISOString() }],
  });

  res.json(updated);
});

/** Turns a prescription straight into a priced basket — the "order these" button. */
pharmacyRoutes.get('/from-prescription/:prescriptionId', (req, res) => {
  const prescription = store.findOrFail('prescriptions', req.params.prescriptionId);

  if (req.auth.role === 'patient' && prescription.patientId !== req.auth.profileId) {
    throw forbidden('That prescription belongs to another patient.');
  }

  const lines = prescription.medicines
    .map((line) => {
      const medicine = line.medicineId ? store.find('medicines', line.medicineId) : null;
      if (!medicine) return { name: line.name, matched: false, reason: 'Not stocked here' };

      return {
        matched: true,
        medicineId: medicine.id,
        name: medicine.name,
        strength: medicine.strength,
        form: medicine.form,
        price: medicine.price,
        mrp: medicine.mrp,
        stock: medicine.stock,
        prescriptionRequired: medicine.prescriptionRequired,
        quantity: 1,
        dosage: `${line.frequency} · ${line.duration}`,
      };
    });

  res.json({
    prescriptionId: prescription.id,
    diagnosis: prescription.diagnosis,
    doctorName: prescription.doctorName,
    issuedAt: prescription.issuedAt,
    lines: lines.filter((line) => line.matched),
    unavailable: lines.filter((line) => !line.matched),
  });
});

/** Pharmacy-side check of a prescription id or QR payload before dispensing. */
pharmacyRoutes.post('/verify-prescription', requireRole('pharmacy', 'admin', 'patient'), (req, res) => {
  const { prescriptionId } = validate(req.body, { prescriptionId: { required: true } });
  const prescription = store.find('prescriptions', prescriptionId.trim().toUpperCase());

  if (!prescription) {
    return res.status(404).json({ error: { status: 404, message: 'No prescription matches that ID.' } });
  }

  if (req.auth.role === 'patient' && prescription.patientId !== req.auth.profileId) {
    throw forbidden('That prescription belongs to another patient.');
  }

  const ageDays = Math.round((Date.now() - Date.parse(prescription.issuedAt)) / 86_400_000);

  res.json({
    valid: ageDays <= 90 && prescription.status === 'active',
    reason: ageDays > 90 ? 'This prescription is more than 90 days old.' : null,
    ageDays,
    prescription,
  });
});

/* ---------------------------------------------------------------- pricing */

/**
 * The shared basket pricer used by both the quote and the order.
 *
 * It re-reads every price and stock level from the store — the client's copy of
 * a price is only ever a display, never an input.
 */
function priceBasket(req, input, patientIdOverride) {
  const patientId = patientIdOverride ?? (req.auth.role === 'patient' ? req.auth.profileId : null);

  const prescription = input.prescriptionId ? store.find('prescriptions', input.prescriptionId) : null;
  const prescriptionValid =
    !!prescription &&
    (!patientId || prescription.patientId === patientId) &&
    Math.round((Date.now() - Date.parse(prescription.issuedAt)) / 86_400_000) <= 90;

  const lines = [];
  const blocked = [];
  const outOfStock = [];

  for (const raw of input.lines) {
    const medicine = store.find('medicines', raw.medicineId);
    if (!medicine) throw badRequest(`"${raw.medicineId}" is not in the catalogue.`);

    const quantity = Math.max(1, Math.min(10, Number(raw.quantity) || 1));

    const line = {
      medicineId: medicine.id,
      name: medicine.name,
      strength: medicine.strength,
      form: medicine.form,
      price: medicine.price,
      mrp: medicine.mrp,
      quantity,
      lineTotal: medicine.price * quantity,
      prescriptionRequired: medicine.prescriptionRequired,
    };

    if (medicine.stock < quantity) outOfStock.push({ ...line, available: medicine.stock });
    else if (medicine.prescriptionRequired && !prescriptionValid) blocked.push(line);
    else lines.push(line);
  }

  const itemsTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  const coupon = input.couponCode
    ? store.findBy(
        'coupons',
        (row) => row.code === input.couponCode.toUpperCase() && row.appliesTo === 'pharmacy',
      )
    : null;

  const discount = discountFor(coupon, itemsTotal);

  return {
    lines,
    blocked,
    outOfStock,
    coupon,
    couponError:
      input.couponCode && !coupon
        ? 'That coupon is not valid for medicines.'
        : coupon && itemsTotal < (coupon.minOrder ?? 0)
          ? `Add ₹${coupon.minOrder - itemsTotal} more to use ${coupon.code}.`
          : null,
    prescriptionStatus: blocked.length
      ? 'required'
      : lines.some((line) => line.prescriptionRequired)
        ? 'verified'
        : 'not-required',
    bill: orderBill(itemsTotal, discount),
  };
}
