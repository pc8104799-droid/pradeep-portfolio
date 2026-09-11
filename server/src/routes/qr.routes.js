import { Router } from 'express';
import { store } from '../db/store.js';
import { ageFrom } from '../lib/dates.js';
import { badRequest, forbidden, notFound } from '../lib/http-error.js';
import { visiblePatient } from '../lib/visibility.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * QR resolution.
 *
 * A MediCare360 QR carries nothing but an id — `PT-000001`, `AP-20260911-0003`.
 * No name, no diagnosis, no token. A scanned code is worthless on its own; what
 * it returns depends entirely on who is asking, which is decided here.
 */
export const qrRoutes = Router();

qrRoutes.use(requireAuth);

/** Which prefix maps to which record, and who is allowed to resolve it. */
const RESOLVERS = {
  PT: { kind: 'patient', collection: 'patients', roles: ['doctor', 'admin', 'pharmacy', 'patient'] },
  AP: { kind: 'appointment', collection: 'appointments', roles: ['doctor', 'admin', 'patient'] },
  RX: { kind: 'prescription', collection: 'prescriptions', roles: ['doctor', 'admin', 'pharmacy', 'patient'] },
  MED: { kind: 'medicine', collection: 'medicines', roles: ['doctor', 'admin', 'pharmacy', 'patient'] },
  RP: { kind: 'report', collection: 'medicalReports', roles: ['doctor', 'admin', 'patient'] },
  MR: { kind: 'record', collection: 'medicalRecords', roles: ['doctor', 'admin', 'patient'] },
  PAY: { kind: 'payment', collection: 'payments', roles: ['admin', 'patient'] },
  ORD: { kind: 'order', collection: 'medicineOrders', roles: ['pharmacy', 'admin', 'patient'] },
  BR: { kind: 'branch', collection: 'hospitalBranches', roles: ['patient', 'doctor', 'admin', 'pharmacy'] },
};

qrRoutes.get('/resolve/:code', (req, res) => {
  res.json(resolve(req, req.params.code));
});

/** The manual-entry fallback, for when the camera is unavailable or denied. */
qrRoutes.post('/resolve', (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  if (!code) throw badRequest('Enter an ID to look up.', { code: 'Enter an ID such as PT-000001.' });

  res.json(resolve(req, code));
});

function resolve(req, rawCode) {
  // Accept a bare id, a `medicare360://PT-000001` deep link, or a full URL.
  const code = rawCode.trim().toUpperCase().replace(/^.*[/:]/, '');
  const prefix = code.split('-')[0];
  const resolver = RESOLVERS[prefix];

  if (!resolver) {
    throw badRequest(`"${rawCode}" is not a MediCare360 code.`, {
      code: 'Codes look like PT-000001, AP-20260911-0003 or RX-000012.',
    });
  }

  if (!resolver.roles.includes(req.auth.role)) {
    throw forbidden(`A ${req.auth.role} account cannot resolve a ${resolver.kind} code.`);
  }

  const row = store.find(resolver.collection, code);
  if (!row) throw notFound(`No ${resolver.kind} matches "${code}".`);

  assertScanAccess(req, resolver.kind, row);

  // A resolved patient goes through the same field-level filter as every other
  // route that returns one — otherwise scanning a card would be a way around it.
  const record = resolver.kind === 'patient' ? visiblePatient(row, req.auth.role) : row;

  return { kind: resolver.kind, code, summary: summarise(resolver.kind, row), record };
}

/**
 * A valid code is not an access grant. A patient may only scan their own
 * records; a doctor may only scan what belongs to a patient they are treating.
 */
function assertScanAccess(req, kind, row) {
  const { role, profileId } = req.auth;
  const patientId = kind === 'patient' ? row.id : row.patientId;

  if (role === 'patient' && patientId && patientId !== profileId) {
    throw forbidden('That code belongs to another patient.');
  }

  if (role === 'doctor' && patientId) {
    const treated = store.findBy(
      'appointments',
      (appointment) => appointment.doctorId === profileId && appointment.patientId === patientId,
    );

    if (!treated) throw forbidden('That patient is not on your list.');
  }
}

/** A short, human line for the scan result card, per record kind. */
function summarise(kind, row) {
  switch (kind) {
    case 'patient':
      return {
        title: row.name,
        lines: [
          `${row.id} · ${ageFrom(row.dateOfBirth)} yrs · ${row.gender}`,
          `Blood group ${row.bloodGroup}`,
          row.allergies?.length ? `Allergies: ${row.allergies.join(', ')}` : 'No known allergies',
        ],
        link: `/patient/profile`,
      };

    case 'appointment':
      return {
        title: `${row.doctorName} · ${row.departmentName}`,
        lines: [`${row.date} at ${row.time}`, `Status: ${row.status}`, `Token: ${row.token ?? '—'}`],
        link: `/patient/appointments/${row.id}`,
      };

    case 'prescription':
      return {
        title: row.diagnosis,
        lines: [
          `${row.doctorName} · ${row.issuedAt.slice(0, 10)}`,
          `${row.medicines.length} medicine${row.medicines.length > 1 ? 's' : ''}`,
          row.followUpDate ? `Follow-up ${row.followUpDate}` : 'No follow-up booked',
        ],
        link: `/patient/prescriptions/${row.id}`,
      };

    case 'report':
      return {
        title: row.testName,
        lines: [`${row.lab} · ${row.reportedOn}`, row.result, `Status: ${row.status}`],
        link: `/patient/reports/${row.id}`,
      };

    case 'record':
      return {
        title: row.diagnosis,
        lines: [`${row.doctorName} · ${row.visitDate}`, row.treatment],
        link: `/patient/records/${row.id}`,
      };

    case 'medicine':
      return {
        title: `${row.name} ${row.strength}`,
        lines: [
          `${row.genericName} · ${row.form}`,
          `₹${row.price} · ${row.stock > 0 ? `${row.stock} in stock` : 'Out of stock'}`,
          row.prescriptionRequired ? 'Prescription required' : 'Available over the counter',
        ],
        link: `/patient/pharmacy/${row.id}`,
      };

    case 'payment':
      return {
        title: `₹${row.amount}`,
        lines: [`${row.kind} · ${row.status}`, row.transactionId ?? 'Not settled', row.createdAt.slice(0, 10)],
        link: `/patient/payments/${row.id}`,
      };

    case 'order':
      return {
        title: `Order ${row.id}`,
        lines: [`${row.lines.length} items · ₹${row.bill.total}`, `Stage: ${row.stage}`],
        link: `/patient/pharmacy/orders/${row.id}`,
      };

    default:
      return { title: row.name ?? row.id, lines: [row.address ?? ''], link: '/patient/dashboard' };
  }
}
