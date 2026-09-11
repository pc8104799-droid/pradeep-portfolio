import { Router } from 'express';
import { store } from '../db/store.js';
import { badRequest, forbidden } from '../lib/http-error.js';
import { nextId, ymd } from '../lib/ids.js';
import { notify } from '../lib/notify.js';
import { listQuery } from '../lib/query.js';
import { validate } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/**
 * The clinical record: consultations, prescriptions, visit history, lab
 * requests and their reports.
 *
 * Everything in here is written by a doctor and read by a patient, so each
 * route pairs a role check with an ownership check — being a doctor is not the
 * same as being *this* patient's doctor.
 *
 * The guards are per route rather than router-wide because this router is
 * mounted at the API root: a blanket `use(requireAuth)` would answer 401 for
 * every unknown URL in the whole API.
 */
export const clinicalRoutes = Router();

/** The one place that decides whether a caller may read a clinical row. */
function assertOwnership(req, row) {
  const { role, profileId } = req.auth;

  if (role === 'patient' && row.patientId !== profileId) {
    throw forbidden('That record belongs to another patient.');
  }
  if (role === 'doctor' && row.doctorId !== profileId) {
    throw forbidden('That record was written by another doctor.');
  }

  return row;
}

function scope(req, collection) {
  const { role, profileId } = req.auth;
  const rows = store.collection(collection);

  if (role === 'patient') return rows.filter((row) => row.patientId === profileId);
  if (role === 'doctor') return rows.filter((row) => row.doctorId === profileId);
  return rows;
}

/* -------------------------------------------------------- consultations */

/**
 * Opens the consultation for an appointment.
 *
 * Idempotent on purpose: a doctor who reloads the consultation screen mid-visit
 * gets the draft they were already writing, not a second empty one.
 */
clinicalRoutes.post('/consultations', requireRole('doctor'), (req, res) => {
  const { appointmentId } = validate(req.body, { appointmentId: { required: true } });

  const appointment = store.findOrFail('appointments', appointmentId);
  if (appointment.doctorId !== req.auth.profileId) {
    throw forbidden('That appointment belongs to another doctor.');
  }

  const existing = store.findBy('consultations', (row) => row.appointmentId === appointmentId);
  if (existing) return res.json(existing);

  const consultation = store.insert('consultations', {
    id: nextId('consultation'),
    appointmentId,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    departmentId: appointment.departmentId,
    date: appointment.date,
    startedAt: new Date().toISOString(),
    completedAt: null,
    chiefComplaint: appointment.reason,
    symptoms: appointment.symptoms ?? [],
    examination: '',
    vitals: {},
    diagnosis: '',
    treatmentPlan: '',
    notes: '',
    prescriptionId: null,
    testRequestIds: [],
    followUpDate: null,
    followUpReason: '',
    status: 'in-progress',
  });

  store.update('appointments', appointmentId, {
    consultationId: consultation.id,
    status: 'in-consultation',
    queueStatus: 'in-consultation',
  });

  res.status(201).json(consultation);
});

clinicalRoutes.get('/consultations/:id', requireAuth, (req, res) => {
  const consultation = assertOwnership(req, store.findOrFail('consultations', req.params.id));

  res.json({
    ...consultation,
    appointment: store.find('appointments', consultation.appointmentId),
    prescription: consultation.prescriptionId ? store.find('prescriptions', consultation.prescriptionId) : null,
    testRequests: store.filter('testRequests', (row) => row.consultationId === consultation.id),
  });
});

clinicalRoutes.patch('/consultations/:id', requireRole('doctor'), (req, res) => {
  const consultation = assertOwnership(req, store.findOrFail('consultations', req.params.id));

  const input = validate(req.body, {
    chiefComplaint: {},
    symptoms: { type: 'array' },
    examination: {},
    vitals: { type: 'object' },
    diagnosis: {},
    treatmentPlan: {},
    notes: {},
    followUpDate: {},
    followUpReason: {},
  });

  res.json(store.update('consultations', consultation.id, input));
});

/**
 * Closes the visit.
 *
 * This is the step that turns a consultation into permanent history: it writes
 * the medical record, marks the appointment completed, and tells the patient.
 */
clinicalRoutes.post('/consultations/:id/complete', requireRole('doctor'), (req, res) => {
  const consultation = assertOwnership(req, store.findOrFail('consultations', req.params.id));

  if (!consultation.diagnosis) {
    throw badRequest('Record a diagnosis before completing the consultation.', {
      diagnosis: 'A diagnosis is required to close a visit.',
    });
  }

  const appointment = store.findOrFail('appointments', consultation.appointmentId);
  const doctor = store.find('doctors', consultation.doctorId);
  const prescription = store.findBy('prescriptions', (row) => row.consultationId === consultation.id);
  const reports = store.filter('medicalReports', (row) => row.appointmentId === appointment.id);
  const tests = store.filter('testRequests', (row) => row.consultationId === consultation.id);

  const completed = store.update('consultations', consultation.id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    prescriptionId: prescription?.id ?? null,
    testRequestIds: tests.map((row) => row.id),
  });

  store.update('appointments', appointment.id, {
    status: 'completed',
    queueStatus: 'completed',
    consultationId: consultation.id,
  });

  const record = store.insert('medicalRecords', {
    id: nextId('record'),
    patientId: consultation.patientId,
    appointmentId: appointment.id,
    consultationId: consultation.id,
    prescriptionId: prescription?.id ?? null,
    reportIds: reports.map((row) => row.id),
    doctorId: consultation.doctorId,
    doctorName: appointment.doctorName,
    departmentName: appointment.departmentName,
    branchId: appointment.branchId,
    visitDate: appointment.date,
    visitType: appointment.visitType,
    diagnosis: consultation.diagnosis,
    symptoms: consultation.symptoms,
    treatment: consultation.treatmentPlan,
    notes: consultation.notes,
    followUpDate: consultation.followUpDate,
  });

  notify({
    ownerId: consultation.patientId,
    audience: 'patient',
    kind: 'consultation',
    title: 'Consultation complete',
    body: `${doctor?.name ?? 'Your doctor'} recorded ${consultation.diagnosis}.${
      consultation.followUpDate ? ` Follow-up on ${consultation.followUpDate}.` : ''
    }`,
    link: `/patient/records/${record.id}`,
  });

  res.json({ consultation: completed, record });
});

/* -------------------------------------------------------- prescriptions */

clinicalRoutes.get('/prescriptions', requireAuth, (req, res) => {
  res.json(
    listQuery(scope(req, 'prescriptions'), req.query, {
      filterable: ['status', 'patientId', 'doctorId'],
      searchable: ['id', 'diagnosis', 'doctorName', 'patientName'],
      defaultSort: '-issuedAt',
    }),
  );
});

clinicalRoutes.get('/prescriptions/:id', requireAuth, (req, res) => {
  const prescription = assertOwnership(req, store.findOrFail('prescriptions', req.params.id));

  res.json({
    ...prescription,
    patient: store.find('patients', prescription.patientId),
    doctor: store.find('doctors', prescription.doctorId),
    // Each line is matched to the pharmacy catalogue so "order these medicines"
    // can go straight into a basket with live prices and stock.
    medicines: prescription.medicines.map((line) => ({
      ...line,
      catalogue: line.medicineId ? store.find('medicines', line.medicineId) : null,
    })),
  });
});

const MEDICINE_LINE = {
  medicineId: {},
  name: { required: true },
  genericName: {},
  strength: {},
  form: {},
  dosage: { required: true },
  frequency: { required: true },
  duration: { required: true },
  timing: { default: 'After food' },
  route: { default: 'Oral' },
  instructions: {},
};

clinicalRoutes.post('/prescriptions', requireRole('doctor'), (req, res) => {
  const input = validate(req.body, {
    consultationId: { required: true },
    diagnosis: { required: true, minLength: 3 },
    medicines: { type: 'array', required: true, min: 1 },
    advice: { default: '' },
    followUpDate: {},
  });

  const consultation = assertOwnership(req, store.findOrFail('consultations', input.consultationId));
  const appointment = store.findOrFail('appointments', consultation.appointmentId);
  const patient = store.find('patients', consultation.patientId);

  // Each line is validated on its own so a bad dosage names its own row rather
  // than failing the whole prescription with one vague message.
  const medicines = input.medicines.map((line, index) => {
    try {
      return validate(line, MEDICINE_LINE);
    } catch (error) {
      throw badRequest(`Medicine ${index + 1} is incomplete.`, error.details ?? {});
    }
  });

  // Prescribing something the patient reacts to is the one clinical mistake
  // this app can actually catch, so it is reported rather than silently saved.
  const allergyHits = medicines.filter((line) =>
    (patient?.allergies ?? []).some((allergy) =>
      `${line.name} ${line.genericName ?? ''}`.toLowerCase().includes(allergy.toLowerCase()),
    ),
  );

  if (allergyHits.length && req.body.acknowledgeAllergy !== true) {
    throw badRequest(
      `${patient.name} is allergic to ${patient.allergies.join(', ')}. Confirm to prescribe anyway.`,
      { medicines: allergyHits.map((line) => line.name).join(', ') },
    );
  }

  const existing = store.findBy('prescriptions', (row) => row.consultationId === consultation.id);

  const payload = {
    appointmentId: appointment.id,
    consultationId: consultation.id,
    patientId: consultation.patientId,
    patientName: appointment.patientName,
    doctorId: consultation.doctorId,
    doctorName: appointment.doctorName,
    departmentName: appointment.departmentName,
    diagnosis: input.diagnosis,
    medicines,
    advice: input.advice,
    followUpDate: input.followUpDate ?? null,
    issuedAt: new Date().toISOString(),
    dispensed: false,
    status: 'active',
  };

  // Re-saving during the same visit revises the prescription in place; a doctor
  // adding a fourth medicine should not leave the patient holding two slips.
  const prescription = existing
    ? store.update('prescriptions', existing.id, payload)
    : store.insert('prescriptions', { id: nextId('prescription'), ...payload });

  store.update('consultations', consultation.id, {
    prescriptionId: prescription.id,
    diagnosis: input.diagnosis,
  });

  notify({
    ownerId: prescription.patientId,
    audience: 'patient',
    kind: 'prescription',
    title: existing ? 'Prescription updated' : 'Prescription ready',
    body: `${prescription.doctorName} · ${medicines.length} medicine${medicines.length > 1 ? 's' : ''}.`,
    link: `/patient/prescriptions/${prescription.id}`,
  });

  res.status(existing ? 200 : 201).json(prescription);
});

/* ------------------------------------------------------ medical records */

clinicalRoutes.get('/medical-records', requireAuth, (req, res) => {
  res.json(
    listQuery(scope(req, 'medicalRecords'), req.query, {
      filterable: ['patientId', 'doctorId', 'visitType'],
      searchable: ['id', 'diagnosis', 'doctorName', 'departmentName', 'treatment'],
      defaultSort: '-visitDate',
    }),
  );
});

clinicalRoutes.get('/medical-records/:id', requireAuth, (req, res) => {
  const record = assertOwnership(req, store.findOrFail('medicalRecords', req.params.id));

  res.json({
    ...record,
    consultation: record.consultationId ? store.find('consultations', record.consultationId) : null,
    prescription: record.prescriptionId ? store.find('prescriptions', record.prescriptionId) : null,
    reports: store.filter('medicalReports', (row) => (record.reportIds ?? []).includes(row.id)),
    branch: store.find('hospitalBranches', record.branchId),
  });
});

/**
 * A patient's history as a year-grouped timeline — the shape the history screen
 * renders directly, rather than a flat list it would have to regroup.
 */
clinicalRoutes.get('/patients/:patientId/timeline', requireAuth, (req, res) => {
  const { role, profileId } = req.auth;
  if (role === 'patient' && profileId !== req.params.patientId) {
    throw forbidden('You can only view your own history.');
  }

  const entries = [
    ...store.filter('medicalRecords', (row) => row.patientId === req.params.patientId).map((row) => ({
      kind: 'visit',
      id: row.id,
      date: row.visitDate,
      title: row.diagnosis,
      subtitle: `${row.doctorName} · ${row.departmentName}`,
      link: `/patient/records/${row.id}`,
    })),
    ...store.filter('prescriptions', (row) => row.patientId === req.params.patientId).map((row) => ({
      kind: 'prescription',
      id: row.id,
      date: row.issuedAt.slice(0, 10),
      title: `${row.medicines.length} medicine${row.medicines.length > 1 ? 's' : ''} prescribed`,
      subtitle: row.doctorName,
      link: `/patient/prescriptions/${row.id}`,
    })),
    ...store.filter('medicalReports', (row) => row.patientId === req.params.patientId).map((row) => ({
      kind: 'report',
      id: row.id,
      date: row.reportedOn,
      title: row.testName,
      subtitle: `${row.lab} · ${row.status}`,
      link: `/patient/reports/${row.id}`,
    })),
    ...store
      .filter('appointments', (row) => row.patientId === req.params.patientId && row.date >= ymd())
      .map((row) => ({
        kind: 'upcoming',
        id: row.id,
        date: row.date,
        title: `${row.visitType === 'follow-up' ? 'Follow-up' : 'Appointment'} · ${row.departmentName}`,
        subtitle: `${row.doctorName} at ${row.time}`,
        link: `/patient/appointments/${row.id}`,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const years = [...new Set(entries.map((entry) => entry.date.slice(0, 4)))].sort().reverse();

  res.json({
    years: years.map((year) => ({
      year,
      entries: entries.filter((entry) => entry.date.startsWith(year)),
    })),
    total: entries.length,
  });
});

/* ------------------------------------------- lab requests and reports */

clinicalRoutes.get('/test-requests', requireAuth, (req, res) => {
  res.json(
    listQuery(scope(req, 'testRequests'), req.query, {
      filterable: ['status', 'category', 'priority', 'patientId', 'doctorId'],
      searchable: ['id', 'testName', 'patientName', 'clinicalReason'],
      defaultSort: '-requestedAt',
    }),
  );
});

clinicalRoutes.post('/test-requests', requireRole('doctor'), (req, res) => {
  const input = validate(req.body, {
    consultationId: { required: true },
    testName: { required: true, minLength: 2 },
    category: {
      required: true,
      oneOf: ['blood', 'urine', 'ecg', 'x-ray', 'mri', 'ct', 'ultrasound', 'other'],
    },
    priority: { default: 'routine', oneOf: ['routine', 'urgent'] },
    clinicalReason: { required: true, minLength: 3 },
    notes: { default: '' },
  });

  const consultation = assertOwnership(req, store.findOrFail('consultations', input.consultationId));
  const appointment = store.findOrFail('appointments', consultation.appointmentId);

  const request = store.insert('testRequests', {
    id: nextId('test'),
    appointmentId: appointment.id,
    consultationId: consultation.id,
    patientId: consultation.patientId,
    patientName: appointment.patientName,
    doctorId: consultation.doctorId,
    doctorName: appointment.doctorName,
    ...input,
    price: 0,
    status: 'requested',
    requestedAt: new Date().toISOString(),
  });

  store.update('consultations', consultation.id, {
    testRequestIds: [...(consultation.testRequestIds ?? []), request.id],
  });

  notify({
    ownerId: consultation.patientId,
    audience: 'patient',
    kind: 'test',
    title: 'Lab test requested',
    body: `${input.testName} — ${input.priority === 'urgent' ? 'urgent' : 'routine'}. Visit the lab to give a sample.`,
    link: '/patient/reports',
  });

  res.status(201).json(request);
});

clinicalRoutes.patch('/test-requests/:id', requireRole('doctor', 'admin'), (req, res) => {
  const request = store.findOrFail('testRequests', req.params.id);
  if (req.auth.role === 'doctor') assertOwnership(req, request);

  const input = validate(req.body, {
    status: {
      required: true,
      oneOf: ['requested', 'scheduled', 'sample-collected', 'processing', 'completed', 'report-available'],
    },
    notes: {},
  });

  res.json(store.update('testRequests', request.id, input));
});

clinicalRoutes.get('/medical-reports', requireAuth, (req, res) => {
  res.json(
    listQuery(scope(req, 'medicalReports'), req.query, {
      filterable: ['category', 'status', 'patientId', 'doctorId', 'lab'],
      searchable: ['id', 'testName', 'lab', 'result', 'patientName'],
      defaultSort: '-reportedOn',
    }),
  );
});

clinicalRoutes.get('/medical-reports/:id', requireAuth, (req, res) => {
  const report = assertOwnership(req, store.findOrFail('medicalReports', req.params.id));

  res.json({
    ...report,
    patient: store.find('patients', report.patientId),
    doctor: store.find('doctors', report.doctorId),
    testRequest: report.testRequestId ? store.find('testRequests', report.testRequestId) : null,
  });
});

/** A doctor's note on a result the lab has already released. */
clinicalRoutes.patch('/medical-reports/:id/comments', requireRole('doctor'), (req, res) => {
  const report = assertOwnership(req, store.findOrFail('medicalReports', req.params.id));
  const { doctorComments } = validate(req.body, { doctorComments: { required: true, minLength: 2 } });

  const updated = store.update('medicalReports', report.id, { doctorComments });

  notify({
    ownerId: report.patientId,
    audience: 'patient',
    kind: 'report',
    title: 'Your doctor reviewed a report',
    body: `${report.testName}: ${doctorComments}`,
    link: `/patient/reports/${report.id}`,
  });

  res.json(updated);
});
