import { store } from '../db/store.js';
import { nextId } from './ids.js';

/**
 * Writes a notification for one person.
 *
 * `ownerId` is a patient or doctor id rather than a user id, because that is
 * what every other record in the store points at — the notification list a
 * patient sees is simply "rows addressed to my patient id".
 */
export function notify({ ownerId, audience, kind, title, body, link = null }) {
  if (!ownerId) return null;

  return store.insert('notifications', {
    id: nextId('notification'),
    ownerId,
    audience,
    kind,
    title,
    body,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

/** Both sides of an appointment usually need telling at the same moment. */
export function notifyBoth({ patientId, doctorId, kind, patient, doctor }) {
  const written = [];

  if (patient) written.push(notify({ ownerId: patientId, audience: 'patient', kind, ...patient }));
  if (doctor) written.push(notify({ ownerId: doctorId, audience: 'doctor', kind, ...doctor }));

  return written.filter(Boolean);
}
