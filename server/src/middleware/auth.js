import { store } from '../db/store.js';
import { forbidden, unauthorized } from '../lib/http-error.js';
import { verifyToken } from '../lib/jwt.js';

/**
 * Reads the bearer token if one is present and hangs the account off the
 * request. It never rejects: endpoints that are open to anonymous callers
 * (department list, medicine catalogue) still need to know who is asking.
 */
export function readSession(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const claims = token ? verifyToken(token) : null;

  req.auth = null;

  if (claims) {
    const user = store.find('users', claims.sub);

    // A token can outlive the account it names — check the store, not the claim.
    if (user && user.status === 'active') {
      req.auth = {
        userId: user.id,
        email: user.email,
        role: user.role,
        profileId: user.profileId,
        name: user.name,
      };
    }
  }

  next();
}

/** Requires any signed-in account. */
export function requireAuth(req, _res, next) {
  if (!req.auth) throw unauthorized();
  next();
}

/**
 * Requires one of the given roles. This is what keeps a patient out of
 * `/api/doctor/*` even if they guess the URL — the Angular route guard is only
 * navigation polish, the decision is made here.
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth) throw unauthorized();
    if (!roles.includes(req.auth.role)) {
      throw forbidden(`This endpoint is limited to: ${roles.join(', ')}.`);
    }

    next();
  };
}

/**
 * Guards patient-owned records. A patient may only touch their own row; staff
 * may touch any. Returns the patient so handlers do not look it up twice.
 */
export function assertPatientAccess(req, patientId) {
  const { role, profileId } = req.auth;

  if (role === 'patient' && profileId !== patientId) {
    throw forbidden('You can only view your own records.');
  }

  return store.findOrFail('patients', patientId, `No patient matches "${patientId}".`);
}

/** The mirror of the above for doctor-owned rows. */
export function assertDoctorAccess(req, doctorId) {
  const { role, profileId } = req.auth;

  if (role === 'doctor' && profileId !== doctorId) {
    throw forbidden('You can only view your own schedule.');
  }

  return store.findOrFail('doctors', doctorId, `No doctor matches "${doctorId}".`);
}
