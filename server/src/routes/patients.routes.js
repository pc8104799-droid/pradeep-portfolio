import { Router } from 'express';
import { store } from '../db/store.js';
import { ageFrom } from '../lib/dates.js';
import { badRequest } from '../lib/http-error.js';
import { nextId, ymd } from '../lib/ids.js';
import { notify } from '../lib/notify.js';
import { hashPassword } from '../lib/password.js';
import { listQuery } from '../lib/query.js';
import { validate } from '../lib/validate.js';
import { visiblePatient } from '../lib/visibility.js';
import { assertPatientAccess, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/errors.js';

/** Patient records, their family members and their delivery addresses. */
export const patientRoutes = Router();

patientRoutes.use(requireAuth);

/**
 * The directory is staff-only. A patient reading this list would be reading
 * every other patient in the hospital.
 */
patientRoutes.get('/', requireRole('doctor', 'admin', 'pharmacy'), (req, res) => {
  let rows = store.collection('patients');

  // A doctor sees the patients they have actually treated, not the whole
  // hospital — the smallest sensible scope for a consultation workflow.
  if (req.auth.role === 'doctor') {
    const mine = new Set(
      store.filter('appointments', (row) => row.doctorId === req.auth.profileId).map((row) => row.patientId),
    );
    rows = rows.filter((patient) => mine.has(patient.id));
  }

  const page = listQuery(rows, req.query, {
    filterable: ['gender', 'bloodGroup', 'city'],
    searchable: ['id', 'name', 'email', 'mobile'],
    defaultSort: 'name',
  });

  res.json({
    ...page,
    items: page.items.map((patient) => visiblePatient(patient, req.auth.role)),
  });
});

/**
 * Registers a walk-in at the reception desk.
 *
 * Separate from `/auth/register` because the situation is different: the
 * patient is standing at a counter, not choosing a password. Reception records
 * the minimum needed to treat someone and the account is created with a
 * temporary password, which is returned once so it can be handed over.
 */
patientRoutes.post(
  '/',
  requireRole('admin'),
  asyncRoute(async (req, res) => {
    const input = validate(req.body, {
      firstName: { required: true, minLength: 2 },
      middleName: {},
      lastName: { required: true },
      dateOfBirth: { type: 'date', required: true },
      gender: { required: true, oneOf: ['male', 'female', 'other'] },
      bloodGroup: { default: 'unknown' },
      mobile: { required: true, pattern: /^[+0-9 ()-]{10,18}$/ },
      email: { type: 'email', required: true },
      address: { default: '' },
      city: { required: true },
      state: { required: true },
      country: { default: 'India' },
      pincode: { pattern: /^\d{6}$/, message: 'Enter a 6-digit PIN code.', default: '' },
      emergencyContactName: { required: true },
      emergencyContact: { required: true, pattern: /^[+0-9 ()-]{10,18}$/ },
      emergencyContactRelationship: { required: true },
      guardianName: {},
      guardianMobile: {},
      guardianRelationship: {},
      conditions: { type: 'array', default: [] },
      allergies: { type: 'array', default: [] },
      insuranceProvider: { default: '' },
      insuranceNumber: { default: '' },
      preferredBranchId: { default: req.auth.profileId },
    });

    if (store.findBy('users', (row) => row.email === input.email)) {
      throw badRequest('That email already has an account.', {
        email: 'Already registered — search for them instead.',
      });
    }

    const age = ageFrom(input.dateOfBirth);

    if (age < 18 && !input.guardianName) {
      throw badRequest('A patient under 18 needs a guardian on the record.', {
        guardianName: 'Guardian name is required for a patient under 18.',
      });
    }

    const patientId = nextId('patient');
    const patient = store.insert('patients', {
      ...input,
      id: patientId,
      name: `${input.firstName} ${input.lastName}`,
      age,
      currentMedicines: [],
      previousHospital: '',
      maritalStatus: 'single',
      occupation: '',
      registeredAt: new Date().toISOString(),
      status: 'active',
    });

    // Readable and obviously temporary, so nobody mistakes it for a real one.
    const temporaryPassword = `MC-${patientId.slice(-4)}-${Math.floor(Math.random() * 9000 + 1000)}`;

    store.insert('users', {
      id: nextId('user'),
      email: input.email,
      passwordHash: await hashPassword(temporaryPassword),
      role: 'patient',
      name: patient.name,
      profileId: patientId,
      status: 'active',
      createdAt: patient.registeredAt,
    });

    notify({
      ownerId: patientId,
      audience: 'patient',
      kind: 'system',
      title: 'Registered at MediCare360',
      body: `Your patient ID is ${patientId}. Reception created this record — change your password when you first sign in.`,
      link: '/patient/profile',
    });

    res.status(201).json({ patient, temporaryPassword });
  }),
);

patientRoutes.get('/:id', (req, res) => {
  const patient = assertPatientAccess(req, req.params.id);

  res.json({
    ...visiblePatient(patient, req.auth.role),
    age: ageFrom(patient.dateOfBirth),
    branch: store.find('hospitalBranches', patient.preferredBranchId),
  });
});

/**
 * The whole patient in one response.
 *
 * The dashboard, the doctor's patient view and the emergency card all need the
 * same joined picture; doing the joins here keeps those screens from firing
 * eight parallel requests and stitching the result together three times.
 */
patientRoutes.get('/:id/summary', (req, res) => {
  const patient = assertPatientAccess(req, req.params.id);
  const today = ymd();

  const appointments = store
    .filter('appointments', (row) => row.patientId === patient.id)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  const upcoming = [...appointments]
    .filter((row) => row.date >= today && ['pending', 'confirmed', 'checked-in', 'in-consultation'].includes(row.status))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const prescriptions = store
    .filter('prescriptions', (row) => row.patientId === patient.id)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  const reports = store
    .filter('medicalReports', (row) => row.patientId === patient.id)
    .sort((a, b) => b.reportedOn.localeCompare(a.reportedOn));

  const records = store
    .filter('medicalRecords', (row) => row.patientId === patient.id)
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  const payments = store
    .filter('payments', (row) => row.patientId === patient.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const orders = store
    .filter('medicineOrders', (row) => row.patientId === patient.id)
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));

  // "Current medicines" is derived, not stored: it is whatever the most recent
  // prescription put the patient on, which is the honest answer.
  const currentMedicines = prescriptions[0]?.medicines ?? [];

  res.json({
    patient: { ...patient, age: ageFrom(patient.dateOfBirth) },
    upcomingAppointment: upcoming[0] ?? null,
    lastAppointment: appointments.find((row) => row.status === 'completed') ?? null,
    counts: {
      appointments: appointments.length,
      prescriptions: prescriptions.length,
      reports: reports.length,
      records: records.length,
      orders: orders.length,
      unreadNotifications: store.filter(
        'notifications',
        (row) => row.ownerId === patient.id && !row.read,
      ).length,
    },
    currentMedicines,
    latestPrescription: prescriptions[0] ?? null,
    recentReports: reports.slice(0, 4),
    recentRecords: records.slice(0, 4),
    pendingPayments: payments.filter((row) => row.status === 'pending' || row.status === 'failed'),
    totalSpent: payments
      .filter((row) => row.status === 'successful')
      .reduce((sum, row) => sum + row.amount, 0),
    activeOrders: orders.filter((row) => row.stage !== 'delivered' && row.stage !== 'cancelled'),
    familyMembers: store.filter('familyMembers', (row) => row.patientId === patient.id),
  });
});

/** The emergency card — the short list that matters when someone collapses. */
patientRoutes.get('/:id/emergency', (req, res) => {
  const patient = assertPatientAccess(req, req.params.id);
  const latest = store
    .filter('prescriptions', (row) => row.patientId === patient.id)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];

  res.json({
    patientId: patient.id,
    name: patient.name,
    age: ageFrom(patient.dateOfBirth),
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    allergies: patient.allergies ?? [],
    conditions: patient.conditions ?? [],
    currentMedicines: latest?.medicines?.map((line) => `${line.name} ${line.strength} — ${line.frequency}`) ?? [],
    emergencyContactName: patient.emergencyContactName,
    emergencyContact: patient.emergencyContact,
    emergencyContactRelationship: patient.emergencyContactRelationship,
    insuranceProvider: patient.insuranceProvider,
    insuranceNumber: patient.insuranceNumber,
    branch: store.find('hospitalBranches', patient.preferredBranchId),
  });
});

patientRoutes.patch('/:id', (req, res) => {
  assertPatientAccess(req, req.params.id);

  const input = validate(req.body, {
    firstName: { minLength: 2 },
    middleName: {},
    lastName: { minLength: 1 },
    mobile: { pattern: /^[+0-9 ()-]{10,18}$/ },
    email: { type: 'email' },
    address: { minLength: 5 },
    city: {},
    state: {},
    country: {},
    pincode: { pattern: /^\d{6}$/, message: 'Enter a 6-digit PIN code.' },
    emergencyContact: { pattern: /^[+0-9 ()-]{10,18}$/ },
    emergencyContactName: {},
    emergencyContactRelationship: {},
    guardianName: {},
    guardianMobile: {},
    guardianRelationship: {},
    maritalStatus: {},
    occupation: {},
    bloodGroup: { oneOf: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] },
    conditions: { type: 'array' },
    allergies: { type: 'array' },
    currentMedicines: { type: 'array' },
    previousHospital: {},
    insuranceProvider: {},
    insuranceNumber: {},
    preferredBranchId: {},
  });

  // Email is the login identity, so it cannot collide with another account.
  if (input.email) {
    const taken = store.findBy(
      'users',
      (row) => row.email === input.email && row.profileId !== req.params.id,
    );
    if (taken) throw badRequest('Some fields need attention.', { email: 'That email is already in use.' });

    const user = store.findBy('users', (row) => row.profileId === req.params.id);
    if (user) store.update('users', user.id, { email: input.email });
  }

  const patch = { ...input };
  if (input.firstName || input.lastName) {
    const current = store.find('patients', req.params.id);
    patch.name = `${input.firstName ?? current.firstName} ${input.lastName ?? current.lastName}`;
  }

  res.json(store.update('patients', req.params.id, patch));
});

/* ------------------------------------------------------------- family */

patientRoutes.get('/:id/family', (req, res) => {
  assertPatientAccess(req, req.params.id);
  res.json({ items: store.filter('familyMembers', (row) => row.patientId === req.params.id) });
});

const FAMILY_SCHEMA = {
  firstName: { required: true, minLength: 2 },
  lastName: { required: true },
  relationship: {
    required: true,
    oneOf: ['Father', 'Mother', 'Son', 'Daughter', 'Spouse', 'Brother', 'Sister', 'Guardian'],
  },
  dateOfBirth: { type: 'date', required: true },
  gender: { required: true, oneOf: ['male', 'female', 'other'] },
  bloodGroup: { default: 'unknown' },
  mobile: { pattern: /^[+0-9 ()-]{10,18}$/ },
  conditions: { type: 'array', default: [] },
  allergies: { type: 'array', default: [] },
  guardianName: {},
  guardianMobile: {},
  guardianRelationship: {},
};

patientRoutes.post('/:id/family', (req, res) => {
  assertPatientAccess(req, req.params.id);

  const input = validate(req.body, FAMILY_SCHEMA);
  const age = ageFrom(input.dateOfBirth);

  if (age < 18 && !input.guardianName) {
    throw badRequest('Guardian details are needed for a member under 18.', {
      guardianName: 'Guardian name is required for a member under 18.',
    });
  }

  res.status(201).json(
    store.insert('familyMembers', {
      id: nextId('family'),
      patientId: req.params.id,
      ...input,
      name: `${input.firstName} ${input.lastName}`,
      age,
      createdAt: new Date().toISOString(),
    }),
  );
});

patientRoutes.patch('/:id/family/:memberId', (req, res) => {
  assertPatientAccess(req, req.params.id);

  const member = store.findOrFail('familyMembers', req.params.memberId);
  if (member.patientId !== req.params.id) throw badRequest('That member belongs to another patient.');

  const input = validate(req.body, FAMILY_SCHEMA);

  res.json(
    store.update('familyMembers', member.id, {
      ...input,
      name: `${input.firstName} ${input.lastName}`,
      age: ageFrom(input.dateOfBirth),
    }),
  );
});

patientRoutes.delete('/:id/family/:memberId', (req, res) => {
  assertPatientAccess(req, req.params.id);

  const member = store.findOrFail('familyMembers', req.params.memberId);
  if (member.patientId !== req.params.id) throw badRequest('That member belongs to another patient.');

  store.remove('familyMembers', member.id);
  res.json({ ok: true });
});

/* ---------------------------------------------------------- addresses */

patientRoutes.get('/:id/addresses', (req, res) => {
  assertPatientAccess(req, req.params.id);
  res.json({ items: store.filter('addresses', (row) => row.ownerId === req.params.id) });
});

patientRoutes.post('/:id/addresses', (req, res) => {
  assertPatientAccess(req, req.params.id);

  const input = validate(req.body, {
    label: { default: 'Home' },
    name: { required: true },
    phone: { required: true, pattern: /^[+0-9 ()-]{10,18}$/ },
    line1: { required: true, minLength: 5 },
    city: { required: true },
    state: { required: true },
    pincode: { required: true, pattern: /^\d{6}$/, message: 'Enter a 6-digit PIN code.' },
    landmark: { default: '' },
    isDefault: { type: 'boolean', default: false },
  });

  const existing = store.filter('addresses', (row) => row.ownerId === req.params.id);

  // The first address saved is always the default, whatever the form said.
  const isDefault = input.isDefault || existing.length === 0;
  if (isDefault) {
    for (const address of existing) store.update('addresses', address.id, { isDefault: false });
  }

  res.status(201).json(
    store.insert('addresses', {
      id: nextId('address'),
      ownerId: req.params.id,
      ...input,
      isDefault,
    }),
  );
});

patientRoutes.delete('/:id/addresses/:addressId', (req, res) => {
  assertPatientAccess(req, req.params.id);

  const address = store.findOrFail('addresses', req.params.addressId);
  if (address.ownerId !== req.params.id) throw badRequest('That address belongs to another account.');

  store.remove('addresses', address.id);
  res.json({ ok: true });
});
