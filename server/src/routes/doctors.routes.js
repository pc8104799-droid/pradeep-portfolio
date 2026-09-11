import { Router } from 'express';
import { store } from '../db/store.js';
import { badRequest } from '../lib/http-error.js';
import { nextId, ymd } from '../lib/ids.js';
import { listQuery } from '../lib/query.js';
import { nextAvailable, slotsFor } from '../lib/slots.js';
import { validate } from '../lib/validate.js';
import { assertDoctorAccess, requireAuth, requireRole } from '../middleware/auth.js';

/** The doctor directory, their published hours, and their leave calendar. */
export const doctorRoutes = Router();

doctorRoutes.get('/', (req, res) => {
  let rows = store.collection('doctors');

  const { minExperience, maxFee, branchId, availableOn } = req.query;

  if (minExperience) rows = rows.filter((doctor) => doctor.experience >= Number(minExperience));
  if (maxFee) rows = rows.filter((doctor) => doctor.consultationFee <= Number(maxFee));
  if (branchId) rows = rows.filter((doctor) => doctor.branchIds.includes(branchId));

  // "Available on this date" has to run the slot generator, so it is applied
  // after the cheap filters have already narrowed the list.
  if (availableOn) {
    rows = rows.filter((doctor) => slotsFor(doctor.id, String(availableOn)).slots.some((slot) => slot.available));
  }

  const result = listQuery(rows, req.query, {
    filterable: ['departmentId', 'gender', 'languages', 'specialization'],
    searchable: ['name', 'specialization', 'departmentName', 'qualification', 'about'],
    defaultSort: '-rating',
  });

  res.json({
    ...result,
    items: result.items.map((doctor) => ({ ...doctor, nextAvailable: nextAvailable(doctor.id) })),
  });
});

doctorRoutes.get('/:id', (req, res) => {
  const doctor = store.findOrFail('doctors', req.params.id);
  const availability = store.findBy('doctorAvailability', (row) => row.doctorId === doctor.id);
  const branches = store.filter('hospitalBranches', (row) => doctor.branchIds.includes(row.id));

  res.json({
    ...doctor,
    availability: availability ?? null,
    branches,
    nextAvailable: nextAvailable(doctor.id),
    leaves: store.filter(
      'doctorLeaves',
      (row) => row.doctorId === doctor.id && row.to >= ymd() && row.status === 'approved',
    ),
  });
});

/** The booking wizard's slot picker calls this on every date change. */
doctorRoutes.get('/:id/slots', (req, res) => {
  store.findOrFail('doctors', req.params.id);

  const date = String(req.query.date ?? ymd());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Pass ?date=YYYY-MM-DD.');

  res.json(slotsFor(req.params.id, date));
});

/** Seven days of slot counts, for the date strip above the slot picker. */
doctorRoutes.get('/:id/slot-summary', (req, res) => {
  store.findOrFail('doctors', req.params.id);

  const days = Math.min(Number(req.query.days ?? 14), 60);
  const start = new Date();

  const items = Array.from({ length: days }, (_value, offset) => {
    const date = ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset));
    const day = slotsFor(req.params.id, date);

    return {
      date,
      working: day.working,
      reason: day.reason,
      available: day.slots.filter((slot) => slot.available).length,
      total: day.slots.length,
    };
  });

  res.json({ items });
});

doctorRoutes.get('/:id/availability', requireAuth, (req, res) => {
  assertDoctorAccess(req, req.params.id);

  res.json(
    store.findBy('doctorAvailability', (row) => row.doctorId === req.params.id) ?? {
      doctorId: req.params.id,
      slotMinutes: 20,
      maxPerSlot: 1,
      schedule: {},
    },
  );
});

doctorRoutes.put('/:id/availability', requireAuth, requireRole('doctor', 'admin'), (req, res) => {
  assertDoctorAccess(req, req.params.id);

  const input = validate(req.body, {
    slotMinutes: { type: 'number', required: true, min: 5, max: 120 },
    maxPerSlot: { type: 'number', required: true, min: 1, max: 6 },
    breakStart: { default: '' },
    breakEnd: { default: '' },
    schedule: { type: 'object', required: true },
  });

  const existing = store.findBy('doctorAvailability', (row) => row.doctorId === req.params.id);

  const saved = existing
    ? store.update('doctorAvailability', existing.id, input)
    : store.insert('doctorAvailability', { id: `AVL-${req.params.id}`, doctorId: req.params.id, ...input });

  res.json(saved);
});

doctorRoutes.get('/:id/leaves', requireAuth, (req, res) => {
  assertDoctorAccess(req, req.params.id);

  res.json({
    items: store
      .filter('doctorLeaves', (row) => row.doctorId === req.params.id)
      .sort((a, b) => b.from.localeCompare(a.from)),
  });
});

doctorRoutes.post('/:id/leaves', requireAuth, requireRole('doctor', 'admin'), (req, res) => {
  assertDoctorAccess(req, req.params.id);

  const input = validate(req.body, {
    from: { type: 'date', required: true },
    to: { type: 'date', required: true },
    reason: { required: true, minLength: 3 },
  });

  if (input.to < input.from) throw badRequest('The end date cannot be before the start date.');

  // Appointments already on the books during the leave are surfaced rather than
  // silently cancelled — the doctor decides what happens to each one.
  const clashes = store.filter(
    'appointments',
    (row) =>
      row.doctorId === req.params.id &&
      row.date >= input.from &&
      row.date <= input.to &&
      ['pending', 'confirmed', 'checked-in'].includes(row.status),
  );

  const leave = store.insert('doctorLeaves', {
    id: nextId('leave'),
    doctorId: req.params.id,
    ...input,
    status: 'approved',
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ leave, clashes });
});

doctorRoutes.delete('/:id/leaves/:leaveId', requireAuth, requireRole('doctor', 'admin'), (req, res) => {
  assertDoctorAccess(req, req.params.id);
  store.remove('doctorLeaves', req.params.leaveId);

  res.json({ ok: true });
});

doctorRoutes.patch('/:id', requireAuth, requireRole('doctor', 'admin'), (req, res) => {
  assertDoctorAccess(req, req.params.id);

  // Fee, registration number and department are hospital administration, not
  // something a doctor edits from their own profile screen.
  const input = validate(req.body, {
    phone: { pattern: /^[+0-9 ()-]{10,18}$/ },
    languages: { type: 'array' },
    about: { minLength: 20 },
    acceptsOnline: { type: 'boolean' },
    photoInitials: {},
  });

  res.json(store.update('doctors', req.params.id, input));
});
