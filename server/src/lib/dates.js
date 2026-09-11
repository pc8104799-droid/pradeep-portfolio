/** Date and clock helpers shared by the seed, the slot generator and the routes. */

/** Whole years between a `YYYY-MM-DD` birth date and today. */
export function ageFrom(dateOfBirth) {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return 0;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();

  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());

  if (beforeBirthday) age -= 1;
  return Math.max(0, age);
}

/** `"09:30"` plus minutes, wrapping at midnight. */
export function addMinutes(time, minutes) {
  const total = toMinutes(time) + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;

  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

export function toMinutes(time) {
  const [hours, mins] = String(time).split(':').map(Number);
  return (hours || 0) * 60 + (mins || 0);
}

/** `Thu, 11 Sep` — the format notification bodies use. */
export function prettyDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
