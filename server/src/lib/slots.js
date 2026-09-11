import { store } from '../db/store.js';
import { addMinutes } from './dates.js';
import { ymd } from './ids.js';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Statuses that still hold a slot. A cancelled visit frees it again. */
const BLOCKING = new Set(['pending', 'confirmed', 'checked-in', 'in-consultation', 'completed']);

/**
 * Builds a doctor's bookable slots for one day.
 *
 * Slots are computed, never stored. That is the whole point: the file only ever
 * holds the appointments that exist, so a slot cannot drift out of sync with
 * them, and changing a doctor's working hours immediately changes what patients
 * can book without a migration.
 */
export function slotsFor(doctorId, date, { includeBooked = true } = {}) {
  const availability = store.findBy('doctorAvailability', (row) => row.doctorId === doctorId);
  if (!availability) return { date, working: false, reason: 'No schedule published.', slots: [] };

  const leave = store.findBy(
    'doctorLeaves',
    (row) => row.doctorId === doctorId && row.status === 'approved' && date >= row.from && date <= row.to,
  );

  if (leave) {
    return { date, working: false, reason: `On leave until ${leave.to}.`, slots: [] };
  }

  const day = availability.schedule?.[DAY_KEYS[new Date(`${date}T00:00:00`).getDay()]];
  if (!day?.working || !day.windows?.length) {
    return { date, working: false, reason: 'Not consulting on this day.', slots: [] };
  }

  const booked = new Map();
  for (const appointment of store.filter('appointments', (row) => row.doctorId === doctorId && row.date === date)) {
    if (!BLOCKING.has(appointment.status)) continue;
    booked.set(appointment.time, (booked.get(appointment.time) ?? 0) + 1);
  }

  const isToday = date === ymd();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const slots = [];

  for (const window of day.windows) {
    for (let time = window.start; time < window.end; time = addMinutes(time, availability.slotMinutes)) {
      const taken = booked.get(time) ?? 0;
      const past = isToday && toMinutes(time) <= nowMinutes;
      const available = !past && taken < availability.maxPerSlot;

      if (!available && !includeBooked) continue;

      slots.push({
        time,
        endTime: addMinutes(time, availability.slotMinutes),
        available,
        reason: past ? 'past' : taken >= availability.maxPerSlot ? 'booked' : null,
      });
    }
  }

  return { date, working: true, slotMinutes: availability.slotMinutes, reason: null, slots };
}

/** True when the doctor can still take a booking at that exact time. */
export function slotIsFree(doctorId, date, time) {
  const day = slotsFor(doctorId, date);
  return day.working && day.slots.some((slot) => slot.time === time && slot.available);
}

/** The next N days that have at least one free slot — powers "next available". */
export function nextAvailable(doctorId, days = 21) {
  const today = new Date();

  for (let offset = 0; offset < days; offset += 1) {
    const date = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
    const day = slotsFor(doctorId, date);
    const free = day.slots.find((slot) => slot.available);

    if (free) return { date, time: free.time };
  }

  return null;
}

function toMinutes(time) {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}
