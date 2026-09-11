# MediCare360 API

The backend for the MediCare360 hospital platform. Express over a JSON document store, no
database to install and no build step.

```bash
npm run api          # from the repo root -> http://127.0.0.1:3000/api
npm run api:seed     # regenerate data/db.json from scratch
npm run api:test     # 51 checks against the running API
```

`data/db.json` is created on first boot. Every seeded account shares the password
`Medicare@360`, and `GET /api/auth/demo-accounts` prints the four of them, which is what the
sign-in screen offers as one-click fills.

| Role | Email |
| --- | --- |
| Patient | `aarav.sharma@example.com` |
| Doctor | `dr.mehta@medicare360.in` |
| Reception | `admin@medicare360.in` |
| Pharmacy | `pharmacy@medicare360.in` |

## How it is put together

```
src/
  index.js               boots the store, then listens
  app.js                 the Express app, separated so a test can drive it portless
  config.js              port, db path, token secret, CORS, TTL
  db/
    store.js             in-memory read model + coalesced atomic writes to db.json
    seed.js              generates the whole demo hospital, dated relative to today
  lib/
    jwt.js               HS256 sign/verify over node:crypto
    password.js          PBKDF2-SHA-256, 120k iterations, per-account salt
    billing.js           every amount the app displays is computed here
    slots.js             bookable slots, computed from availability — never stored
    query.js             the shared filter / search / sort / page pipeline
    validate.js          field-keyed 400s the Angular forms render inline
    notify.js            writes notifications for a patient or a doctor
    ids.js, dates.js     PT-000001 / AP-20260911-0004 id generation, date helpers
  middleware/
    auth.js              readSession, requireAuth, requireRole, ownership assertions
    errors.js            one failure envelope, 404 handler, async wrapper
  routes/                one module per area of the hospital
```

Four decisions shape the rest of it.

**Money is never an input.** The client sends what was chosen — a doctor, a coupon, a basket —
and `lib/billing.js` prices it. That is why the review step, the payment screen and the printed
receipt can never disagree, and why a tampered request cannot buy a ₹1,200 consultation for ₹1.

**Slots are computed, not stored.** `lib/slots.js` derives a doctor's bookable times from their
published availability, their leave and the appointments that actually exist. A slot therefore
cannot drift out of sync with the bookings, and changing working hours changes the booking
calendar immediately with nothing to migrate.

**Roles are enforced here, field by field.** The Angular route guards are navigation polish;
`requireRole` and the ownership assertions are the decision. A patient reading another patient's
record, a doctor reading a patient they have never treated, or anyone resolving a QR code for
somebody else's prescription all get a 403.

It goes past route access. `lib/visibility.js` decides which *fields* of a patient each role
receives: reception and the patient get everything, a doctor loses the address, occupation and
insurance details, and the pharmacy is cut down to name, age, mobile and allergies. Every route
that returns a patient — the record, the directory, an appointment, a QR scan — goes through it,
because a UI that says "withheld from the clinical view" is only telling the truth if the
response actually withholds it.

**One failure shape.** Every error is `{ error: { status, message, details? } }`. `details` is
keyed by field name, which is what lets a reactive form mark the exact control the server
rejected. An unexpected throw is logged in full and reported as a generic 500, so a stack trace
never reaches a browser.

## Endpoints

Everything lives under `/api`. Lists accept `?q=`, `?sort=field` / `?sort=-field`, `?page=`,
`?limit=` and equality filters on the fields named below.

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/register` | Patient self-registration. A patient under 18 must carry guardian details. |
| `POST` | `/auth/login` | Returns a token, the account and its role profile. |
| `GET` | `/auth/me` | Re-reads the account behind the current token. |
| `PATCH` | `/auth/password` | Requires the current password. |
| `GET` | `/auth/demo-accounts` | The seeded logins, for the demo. |

### Reference data — open without a token

`GET /branches`, `/departments`, `/departments/:id`, `/medicine-categories`, `/medicines`,
`/medicines/:id`, `/coupons?appliesTo=pharmacy|consultation`

`/medicines` also takes `inStock`, `maxPrice` and `prescriptionRequired`.

`PATCH /medicines/:id` (pharmacy or admin) takes `stock`, `price` and `expiryDate` — and nothing
else. Renaming a medicine or changing whether it needs a prescription is a regulatory matter
rather than a counter decision, so those fields are refused.

### Doctors

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/doctors` | Filters: `departmentId`, `gender`, `languages`, `specialization`, `minExperience`, `maxFee`, `branchId`, `availableOn`. Each row carries its next free slot. |
| `GET` | `/doctors/:id` | Plus availability, branches and approved leave. |
| `GET` | `/doctors/:id/slots?date=` | One day's slots, each marked free / booked / past. |
| `GET` | `/doctors/:id/slot-summary?days=` | Slot counts per day, for the date strip. |
| `GET` `PUT` | `/doctors/:id/availability` | Doctor or admin. Saving changes what patients can book. |
| `GET` `POST` | `/doctors/:id/leaves` | `POST` returns any appointments that clash, rather than cancelling them. |
| `DELETE` | `/doctors/:id/leaves/:leaveId` | |
| `PATCH` | `/doctors/:id` | Phone, languages, about, online consultations. Fee and registration are administration. |

### Patients

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/patients` | Staff only. A doctor sees only patients they have treated. |
| `POST` | `/patients` | Reception registers a walk-in; returns a temporary password once. |
| `GET` | `/patients/:id` | |
| `GET` | `/patients/:id/summary` | The joined dashboard: appointments, prescriptions, reports, payments, orders, family. |
| `GET` | `/patients/:id/emergency` | The emergency card. |
| `GET` | `/patients/:id/timeline` | History grouped by year. |
| `PATCH` | `/patients/:id` | |
| `GET` `POST` | `/patients/:id/family` | `PATCH` / `DELETE` on `/family/:memberId`. |
| `GET` `POST` | `/patients/:id/addresses` | `DELETE` on `/addresses/:addressId`. |

### Appointments and the queue

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/appointments` | Scoped to the caller. Also `from`, `to`, `upcoming`, `past`. |
| `GET` | `/appointments/:id` | Plus patient, doctor, branch, payment, consultation, prescription, reports. |
| `POST` | `/appointments` | Re-checks the slot, detects a follow-up, prices the visit and creates a pending payment. `409` if the slot went. |
| `PATCH` | `/appointments/:id/reschedule` | |
| `POST` | `/appointments/:id/cancel` | Refunds a settled payment. |
| `POST` | `/appointments/:id/check-in` | Assigns the day's next token. |
| `GET` | `/appointments/queue/today?date=&doctorId=` | Ordered the way patients are called. |
| `POST` | `/appointments/:id/queue` | `call`, `start`, `complete`, `no-show`, `reset`. |

### Clinical

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/consultations` | Opens (or resumes) the consultation for an appointment. Idempotent. |
| `GET` `PATCH` | `/consultations/:id` | The draft the doctor writes as they work. |
| `POST` | `/consultations/:id/complete` | Refuses without a diagnosis. Writes the medical record and notifies the patient. |
| `GET` | `/prescriptions`, `/prescriptions/:id` | Detail matches each line to the pharmacy catalogue. |
| `POST` | `/prescriptions` | Refuses a drug that clashes with a recorded allergy until `acknowledgeAllergy` is sent. |
| `GET` | `/medical-records`, `/medical-records/:id` | |
| `GET` `POST` | `/test-requests` | `PATCH /test-requests/:id` moves it along the lab workflow. |
| `GET` | `/medical-reports`, `/medical-reports/:id` | |
| `PATCH` | `/medical-reports/:id/comments` | The ordering doctor only. Notifies the patient. |

### Pharmacy

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/pharmacy/quote` | Prices a basket. Reports blocked (℞-only) and out-of-stock lines separately. |
| `GET` `POST` | `/pharmacy/orders` | Placing decrements stock. |
| `GET` | `/pharmacy/orders/:id` | |
| `POST` | `/pharmacy/orders/:id/advance` | Pharmacy or admin. |
| `POST` | `/pharmacy/orders/:id/cancel` | Returns the stock and refunds. |
| `GET` | `/pharmacy/from-prescription/:id` | A prescription as a priced basket. |
| `POST` | `/pharmacy/verify-prescription` | Valid for 90 days from issue. |

### Payments, notifications, QR, stats

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/payments`, `/payments/:id` | A doctor sees only their own consultation fees. |
| `POST` | `/payments/:id/pay` | `method` plus `simulate: success \| failure`. A decline is a `402`. Settling confirms the appointment or the order. |
| `GET` | `/payments/:id/receipt` | Everything a printable receipt needs. |
| `GET` | `/notifications`, `/notifications/unread-count` | `POST /:id/read`, `POST /read-all`, `DELETE /:id`. |
| `GET` `POST` | `/qr/resolve[/:code]` | Resolves `PT-`, `AP-`, `RX-`, `MED-`, `RP-`, `MR-`, `PAY-`, `ORD-`, `BR-`. What comes back depends on who asks. |
| `GET` | `/stats/doctor/:id`, `/stats/patient/:id` | Dashboard aggregates, computed server-side. |
| `GET` | `/stats/hospital` | Reception: today's clinic, money, pharmacy alerts, charts. Admin only. |
| `GET` | `/stats/pharmacy` | The counter: dispensing queue by stage, stock health, takings. |
| `GET` | `/health` | Status, uptime and a row count per collection. |

## Collections in `db.json`

`users`, `patients`, `familyMembers`, `addresses`, `hospitalBranches`, `departments`, `doctors`,
`doctorAvailability`, `doctorLeaves`, `appointments`, `consultations`, `prescriptions`,
`medicines`, `medicineCategories`, `medicineOrders`, `medicalRecords`, `medicalReports`,
`testRequests`, `payments`, `notifications`, `coupons`.

Records reference each other by id rather than nesting, so a prescription points at the
consultation that produced it and the appointment that produced that. The clinic queue is
derived from `appointments` (`token`, `queueStatus`, `checkedInAt`) rather than being a
collection of its own — one row per visit, so a token can never disagree with its appointment.

Seed dates are generated relative to the day the file is created: there are always appointments
this morning, history behind them and follow-ups ahead. Delete `data/db.json` (or run
`npm run api:seed`) to get a hospital that is current again.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `3000` | |
| `HOST` | `127.0.0.1` | |
| `DB_FILE` | `server/data/db.json` | |
| `MEDICARE_SECRET` | a development value | The server warns on boot while this is unset. |
| `TOKEN_TTL` | `28800` | Seconds. A working day. |
| `CORS_ORIGIN` | `*` | Comma-separated in production. |
| `DEMO_PASSWORD` | `Medicare@360` | Used by the seed and printed on boot. |

## Tests

`server/test/api.test.mjs` drives the running server over HTTP — no imports, no mocks — so what
it covers is what ships. Start the API, then `npm run api:test`:

```
ok   double booking rejected — That slot was just taken. Pick another time.
ok   declined payment returns 402
ok   appointment confirmed by payment
ok   consultation completed + record written — MR-000027
ok   Rx-only line blocked without a prescription — Amlokind AT
ok   patient cannot scan another patient
ok   minor needs a guardian
```

It books, pays, consults, prescribes, orders and scans against live data, then puts back
anything it changed — so it can be run repeatedly without a reseed.

## What this is not

Passwords are properly derived and roles are properly enforced, but this is a portfolio
backend: the token secret has a development default, the store is a JSON file with no
transactions across requests, and **no payment is ever processed** — `/payments/:id/pay` decides
an outcome and writes the bookkeeping around it. The emergency button contacts nobody.
