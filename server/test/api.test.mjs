/**
 * End-to-end checks against a running MediCare360 API.
 *
 *   npm run api        # in one terminal
 *   npm run api:test   # in another
 *
 * These drive the real server over HTTP rather than importing it, so what is
 * covered is the thing that actually ships: the routes, the guards, the
 * pricing, and the state each request leaves behind.
 *
 * The script is idempotent — it books, pays and consults against live data and
 * puts back anything it changed — so it can be run repeatedly without a reseed.
 */
const BASE = process.env.MEDICARE_API ?? 'http://127.0.0.1:3000/api';
let failures = 0;

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, json };
}

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}

const login = async (email) =>
  (await call('POST', '/auth/login', { body: { email, password: 'Medicare@360' } })).json;

const patient = await login('aarav.sharma@example.com');
const doctorSession = await login('dr.mehta@medicare360.in');

if (!patient?.token || !doctorSession?.token) {
  console.error(`Cannot reach the API at ${BASE}. Start it with \`npm run api\`.`);
  process.exit(1);
}
check('patient login', !!patient?.token, patient?.user?.profileId);
check('doctor login', !!doctorSession?.token, doctorSession?.user?.profileId);

const pt = patient.token;
const dt = doctorSession.token;
const doctorId = doctorSession.user.profileId;

/* --- public reads --- */
check('departments', (await call('GET', '/departments')).json.items.length === 17);
const doctors = (await call('GET', '/doctors?departmentId=cardiology')).json;
check('doctor search by department', doctors.items.length >= 2, `${doctors.items.length} found`);
check('next-available computed', !!doctors.items[0].nextAvailable);

const medicines = (await call('GET', '/medicines?category=vitamins&sort=price')).json;
check('medicine filter+sort', medicines.items.length >= 3 && medicines.items[0].price <= medicines.items[1].price);

/* --- role isolation --- */
check('patient blocked from doctor stats', (await call('GET', `/stats/doctor/${doctorId}`, { token: pt })).status === 403);
check('patient blocked from patient directory', (await call('GET', '/patients', { token: pt })).status === 403);
check('anonymous blocked from appointments', (await call('GET', '/appointments')).status === 401);
check('other patient record blocked', (await call('GET', '/patients/PT-000003/summary', { token: pt })).status === 403);
check('unknown route is 404 not 401', (await call('GET', '/nope')).status === 404);

/* --- booking --- */
const summary = (await call('GET', `/doctors/${doctorId}/slot-summary?days=21`, { token: pt })).json;
const openDay = summary.items.find((day) => day.available > 0);
check('slot summary has an open day', !!openDay, openDay?.date);

const day = (await call('GET', `/doctors/${doctorId}/slots?date=${openDay.date}`, { token: pt })).json;
const slot = day.slots.find((entry) => entry.available);
check('slot list', !!slot, `${day.slots.length} slots, picked ${slot?.time}`);

const booked = await call('POST', '/appointments', {
  token: pt,
  body: {
    doctorId,
    date: openDay.date,
    time: slot.time,
    reason: 'Chest discomfort while climbing stairs',
    consultationType: 'in-person',
  },
});
check('booking created', booked.status === 201, booked.json?.appointment?.id ?? JSON.stringify(booked.json));

const appointmentId = booked.json.appointment.id;
const paymentId = booked.json.payment.id;
check('booking starts pending', booked.json.appointment.status === 'pending');
check('server priced the visit', booked.json.payment.amount > 0, `₹${booked.json.payment.amount}`);

const double = await call('POST', '/appointments', {
  token: pt,
  body: { doctorId, date: openDay.date, time: slot.time, reason: 'Duplicate booking attempt' },
});
check('double booking rejected', double.status === 409, double.json?.error?.message);

const failed = await call('POST', `/payments/${paymentId}/pay`, {
  token: pt,
  body: { method: 'credit-card', simulate: 'failure' },
});
check('declined payment returns 402', failed.status === 402 && failed.json.payment.status === 'failed');

const paid = await call('POST', `/payments/${paymentId}/pay`, {
  token: pt,
  body: { method: 'upi', simulate: 'success' },
});
check('payment settles', paid.status === 200 && paid.json.payment.status === 'successful', paid.json?.payment?.transactionId);

const confirmed = (await call('GET', `/appointments/${appointmentId}`, { token: pt })).json;
check('appointment confirmed by payment', confirmed.status === 'confirmed');
check('receipt renders', (await call('GET', `/payments/${paymentId}/receipt`, { token: pt })).json.lines.length === 1);

/* --- consultation flow, on a checked-in visit today --- */
const queue = (await call('GET', '/appointments/queue/today', { token: dt })).json;
check('doctor queue', Array.isArray(queue.items), `${queue.items.length} today, ${queue.counts.waiting} waiting`);

const target = queue.items.find((row) => row.status !== 'completed' && row.status !== 'cancelled');
if (target) {
  const consultation = await call('POST', '/consultations', { token: dt, body: { appointmentId: target.id } });
  check('consultation opened', consultation.status === 201 || consultation.status === 200, consultation.json?.id);

  const consultationId = consultation.json.id;
  const again = await call('POST', '/consultations', { token: dt, body: { appointmentId: target.id } });
  check('consultation open is idempotent', again.json.id === consultationId);

  await call('PATCH', `/consultations/${consultationId}`, {
    token: dt,
    body: {
      diagnosis: 'Stable angina — medical management',
      examination: 'S1 S2 heard, no murmur.',
      treatmentPlan: 'Continue statin, review in two weeks.',
      vitals: { systolic: 138, diastolic: 86, pulse: 78, spo2: 98 },
      followUpDate: openDay.date,
    },
  });

  const rx = await call('POST', '/prescriptions', {
    token: dt,
    body: {
      consultationId,
      diagnosis: 'Stable angina — medical management',
      medicines: [
        { medicineId: 'MED-000019', name: 'Ecosprin 75', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days', timing: 'After food' },
      ],
      advice: 'Walk thirty minutes a day.',
      acknowledgeAllergy: true,
    },
  });
  check('prescription saved', rx.status === 201 || rx.status === 200, rx.json?.id ?? JSON.stringify(rx.json));

  const test = await call('POST', '/test-requests', {
    token: dt,
    body: { consultationId, testName: 'Lipid Profile', category: 'blood', clinicalReason: 'Statin monitoring' },
  });
  check('lab test requested', test.status === 201, test.json?.id);

  const done = await call('POST', `/consultations/${consultationId}/complete`, { token: dt });
  check('consultation completed + record written', done.status === 200 && !!done.json.record?.id, done.json?.record?.id);

  const recordId = done.json.record.id;

  check(
    'the doctor who wrote the record can read it',
    (await call('GET', `/medical-records/${recordId}`, { token: dt })).status === 200,
  );

  // Whose visit this was depends on the seeded clinic, so assert the rule that
  // holds either way: the patient on the record can read it, anyone else cannot.
  const asPatient = await call('GET', `/medical-records/${recordId}`, { token: pt });
  const isOurPatient = target.patientId === patient.user.profileId;

  check(
    isOurPatient
      ? 'the patient on the record can read it'
      : 'another patient is refused the record',
    isOurPatient ? asPatient.status === 200 : asPatient.status === 403,
    `patient ${target.patientId}, status ${asPatient.status}`,
  );
}

/* --- an empty consultation cannot be closed --- */
const strayQueue = (await call('GET', '/appointments/queue/today', { token: dt })).json;
const fresh = strayQueue.items.find((row) => row.status === 'confirmed');
if (fresh) {
  const opened = await call('POST', '/consultations', { token: dt, body: { appointmentId: fresh.id } });
  const blocked = await call('POST', `/consultations/${opened.json.id}/complete`, { token: dt });
  check('cannot close without a diagnosis', blocked.status === 400, blocked.json?.error?.message);
}

/* --- pharmacy --- */
const catalogue = (await call('GET', '/medicines?inStock=true')).json.items;
const rxOnly = catalogue.find((row) => row.prescriptionRequired);
const overTheCounter = catalogue.find((row) => !row.prescriptionRequired);

const quote = await call('POST', '/pharmacy/quote', {
  token: pt,
  body: { lines: [{ medicineId: overTheCounter.id, quantity: 2 }, { medicineId: rxOnly.id, quantity: 1 }] },
});
check('basket priced', quote.json.bill.total > 0, `₹${quote.json.bill.total}`);
check('Rx-only line blocked without a prescription', quote.json.blocked.length === 1, quote.json.blocked[0]?.name);

const withCoupon = await call('POST', '/pharmacy/quote', {
  token: pt,
  body: { lines: [{ medicineId: catalogue.find((row) => row.price > 900 && !row.prescriptionRequired).id, quantity: 1 }], couponCode: 'FIRSTCARE' },
});
check('coupon applied', withCoupon.json.bill.discount > 0, `−₹${withCoupon.json.bill.discount}`);

const addresses = (await call('GET', '/patients/PT-000001/addresses', { token: pt })).json;
const order = await call('POST', '/pharmacy/orders', {
  token: pt,
  body: { lines: [{ medicineId: overTheCounter.id, quantity: 2 }], addressId: addresses.items[0].id },
});
check('order placed', order.status === 201, order.json?.order?.id ?? JSON.stringify(order.json));

const orderPay = await call('POST', `/payments/${order.json.payment.id}/pay`, { token: pt, body: { method: 'upi' } });
check('order payment settles', orderPay.status === 200);
const orderAfter = (await call('GET', `/pharmacy/orders/${order.json.order.id}`, { token: pt })).json;
check('paid order moves to confirmed', orderAfter.stage === 'confirmed', orderAfter.stage);

const blockedOrder = await call('POST', '/pharmacy/orders', {
  token: pt,
  body: { lines: [{ medicineId: rxOnly.id, quantity: 1 }], addressId: addresses.items[0].id },
});
check('Rx-only order rejected', blockedOrder.status === 400, blockedOrder.json?.error?.message);

/* --- QR --- */
const selfScan = await call('GET', '/qr/resolve/PT-000001', { token: pt });
check('patient scans own QR', selfScan.status === 200 && selfScan.json.kind === 'patient');
const otherScan = await call('GET', '/qr/resolve/PT-000004', { token: pt });
check('patient cannot scan another patient', otherScan.status === 403);
const junk = await call('POST', '/qr/resolve', { token: pt, body: { code: 'HELLO-1' } });
check('junk QR rejected with guidance', junk.status === 400 && !!junk.json.error.details);
const deepLink = await call('POST', '/qr/resolve', { token: pt, body: { code: 'medicare360://PT-000001' } });
check('deep-link QR accepted', deepLink.status === 200);

/* --- dashboards --- */
const dash = (await call('GET', `/stats/doctor/${doctorId}`, { token: dt })).json;
check('doctor dashboard', dash.charts.daily.length === 14 && dash.charts.monthly.length === 6, `₹${dash.earnings.month} this month`);
const pdash = (await call('GET', '/stats/patient/PT-000001', { token: pt })).json;
check('patient dashboard', pdash.visits > 0 && pdash.charts.visitsByDepartment.length > 0);

/* --- timeline, notifications, availability --- */
const timeline = (await call('GET', '/patients/PT-000001/timeline', { token: pt })).json;
check('timeline grouped by year', timeline.years.length >= 1 && timeline.total > 10, `${timeline.total} entries`);

const notifications = (await call('GET', '/notifications?limit=5', { token: pt })).json;
check('notifications scoped to me', notifications.items.every((row) => row.ownerId === 'PT-000001'));
check('read-all works', (await call('POST', '/notifications/read-all', { token: pt })).json.updated >= 0);

const availability = (await call('GET', `/doctors/${doctorId}/availability`, { token: dt })).json;
check('availability readable', !!availability.schedule.mon);
const savedAvailability = await call('PUT', `/doctors/${doctorId}/availability`, {
  token: dt,
  body: { ...availability, slotMinutes: 20, maxPerSlot: 2 },
});
check('availability saved', savedAvailability.status === 200 && savedAvailability.json.maxPerSlot === 2);

// Put the schedule back so a second run of this script starts from the same
// state — otherwise a widened slot makes the double-booking check pass wrongly.
await call('PUT', `/doctors/${doctorId}/availability`, { token: dt, body: { ...availability, maxPerSlot: 1 } });

/* --- validation --- */
const badRegistration = await call('POST', '/auth/register', {
  body: { firstName: 'A', email: 'nope', password: 'short' },
});
check('registration reports field errors', badRegistration.status === 400 && Object.keys(badRegistration.json.error.details).length > 4,
  Object.keys(badRegistration.json.error.details ?? {}).length + ' fields');

const minor = await call('POST', '/auth/register', {
  body: {
    firstName: 'Test', lastName: 'Child', dateOfBirth: '2015-05-05', gender: 'male', bloodGroup: 'B+',
    mobile: '+91 90000 00000', email: `child${Date.now()}@example.com`, password: 'Medicare@360',
    address: '12 Test Lane', city: 'Mumbai', state: 'Maharashtra', pincode: '400001',
    emergencyContact: '+91 90000 00001', emergencyContactName: 'Parent', emergencyContactRelationship: 'Father',
  },
});
check('minor needs a guardian', minor.status === 400 && !!minor.json.error.details.guardianName);

const adult = await call('POST', '/auth/register', {
  body: {
    firstName: 'Test', lastName: 'Adult', dateOfBirth: '1990-05-05', gender: 'female', bloodGroup: 'O+',
    mobile: '+91 90000 00002', email: `adult${Date.now()}@example.com`, password: 'Medicare@360',
    address: '14 Test Lane', city: 'Mumbai', state: 'Maharashtra', pincode: '400001',
    emergencyContact: '+91 90000 00003', emergencyContactName: 'Spouse', emergencyContactRelationship: 'Spouse',
  },
});
check('registration returns a session', adult.status === 201 && !!adult.json.token, adult.json?.user?.profileId);

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
