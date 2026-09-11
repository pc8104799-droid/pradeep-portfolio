import { Router } from 'express';
import { store } from '../db/store.js';
import { ageFrom } from '../lib/dates.js';
import { config } from '../config.js';
import { badRequest, conflict, unauthorized } from '../lib/http-error.js';
import { nextId } from '../lib/ids.js';
import { signToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { validate } from '../lib/validate.js';
import { notify } from '../lib/notify.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/errors.js';

export const authRoutes = Router();

/** The registration form's own shape, validated field by field. */
const REGISTRATION_SCHEMA = {
  firstName: { required: true, minLength: 2 },
  middleName: {},
  lastName: { required: true, minLength: 1 },
  dateOfBirth: { type: 'date', required: true },
  gender: { required: true, oneOf: ['male', 'female', 'other'] },
  bloodGroup: { required: true, oneOf: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] },
  mobile: {
    required: true,
    pattern: /^[+0-9 ()-]{10,18}$/,
    message: 'Enter a valid mobile number.',
  },
  email: { type: 'email', required: true },
  password: { required: true, minLength: 8, message: 'Use at least 8 characters.' },
  address: { required: true, minLength: 5 },
  city: { required: true },
  state: { required: true },
  country: { default: 'India' },
  pincode: { required: true, pattern: /^\d{6}$/, message: 'Enter a 6-digit PIN code.' },
  emergencyContact: { required: true, pattern: /^[+0-9 ()-]{10,18}$/ },
  emergencyContactName: { required: true },
  emergencyContactRelationship: { required: true },
  guardianName: {},
  guardianMobile: {},
  guardianRelationship: {},
  maritalStatus: { default: 'single' },
  occupation: {},
  conditions: { type: 'array', default: [] },
  allergies: { type: 'array', default: [] },
  currentMedicines: { type: 'array', default: [] },
  previousHospital: {},
  insuranceProvider: {},
  insuranceNumber: {},
  preferredBranchId: { default: 'BR-000001' },
};

authRoutes.post(
  '/register',
  asyncRoute(async (req, res) => {
    const input = validate(req.body, REGISTRATION_SCHEMA);

    if (store.findBy('users', (row) => row.email === input.email)) {
      throw conflict('An account with that email already exists. Try signing in.');
    }

    const age = ageFrom(input.dateOfBirth);

    // A minor cannot be the responsible adult on their own record, so the
    // guardian block is only mandatory once we know the date of birth.
    if (age < 18) {
      const missing = {};
      if (!input.guardianName) missing.guardianName = 'Guardian name is required for a patient under 18.';
      if (!input.guardianMobile) missing.guardianMobile = 'Guardian mobile is required for a patient under 18.';
      if (!input.guardianRelationship) missing.guardianRelationship = 'Tell us how the guardian is related.';

      if (Object.keys(missing).length) {
        throw badRequest('Guardian details are needed for a patient under 18.', missing);
      }
    }

    const { password, ...profile } = input;
    const patientId = nextId('patient');

    const patient = store.insert('patients', {
      ...profile,
      id: patientId,
      name: `${profile.firstName} ${profile.lastName}`,
      age,
      registeredAt: new Date().toISOString(),
      status: 'active',
    });

    const user = store.insert('users', {
      id: nextId('user'),
      email: profile.email,
      passwordHash: await hashPassword(password),
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
      title: 'Welcome to MediCare360',
      body: `Your patient ID is ${patientId}. Keep it handy at reception — it is also your QR code.`,
      link: '/patient/profile',
    });

    res.status(201).json(session(user));
  }),
);

authRoutes.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = validate(req.body, {
      email: { type: 'email', required: true },
      password: { required: true },
    });

    const user = store.findBy('users', (row) => row.email === email);

    // Identical failure either way, so the form cannot be used to discover
    // which addresses have accounts.
    const failure = unauthorized('Those details do not match an account.');

    if (!user || user.status !== 'active') throw failure;
    if (!(await verifyPassword(password, user.passwordHash))) throw failure;

    res.json(session(user));
  }),
);

/** Re-reads the account behind the current token — used on app boot. */
authRoutes.get('/me', requireAuth, (req, res) => {
  const user = store.findOrFail('users', req.auth.userId, 'Your session is no longer valid.');
  res.json({ user: publicUser(user), profile: profileFor(user) });
});

authRoutes.patch(
  '/password',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = validate(req.body, {
      currentPassword: { required: true },
      newPassword: { required: true, minLength: 8, message: 'Use at least 8 characters.' },
    });

    const user = store.findOrFail('users', req.auth.userId);

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw unauthorized('Your current password is not correct.');
    }

    store.update('users', user.id, { passwordHash: await hashPassword(newPassword) });
    res.json({ ok: true });
  }),
);

/** The accounts printed on the sign-in screen so the demo needs no setup. */
authRoutes.get('/demo-accounts', (_req, res) => {
  const pickFirst = (role) => store.findBy('users', (row) => row.role === role);

  res.json({
    password: config.demoPassword,
    accounts: ['patient', 'doctor', 'admin', 'pharmacy']
      .map((role) => pickFirst(role))
      .filter(Boolean)
      .map((user) => ({ role: user.role, email: user.email, name: user.name })),
  });
});

function session(user) {
  return {
    token: signToken({ sub: user.id, role: user.role, profileId: user.profileId }),
    expiresIn: config.tokenTtlSeconds,
    user: publicUser(user),
    profile: profileFor(user),
  };
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    profileId: user.profileId,
  };
}

/** The role-specific record the app hangs the whole session off. */
function profileFor(user) {
  if (user.role === 'patient') return store.find('patients', user.profileId);
  if (user.role === 'doctor') return store.find('doctors', user.profileId);
  return store.find('hospitalBranches', user.profileId);
}
