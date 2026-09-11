import { badRequest } from './http-error.js';

/**
 * A deliberately small schema check.
 *
 * Not a validation library: just enough to reject a bad body with a field-keyed
 * map of messages, which is what the Angular reactive forms display inline. A
 * 400 from here always carries `details`, so the client never has to guess which
 * control to mark invalid.
 */
export function validate(body, schema) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Expected a JSON object body.');
  }

  const details = {};
  const value = {};

  for (const [field, rule] of Object.entries(schema)) {
    const raw = body[field];
    const missing = raw === undefined || raw === null || raw === '';

    if (missing) {
      if (rule.required) details[field] = rule.message ?? `${label(field)} is required.`;
      else if (rule.default !== undefined) value[field] = rule.default;
      continue;
    }

    switch (rule.type) {
      case 'number': {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) details[field] = `${label(field)} must be a number.`;
        else if (rule.min !== undefined && parsed < rule.min)
          details[field] = `${label(field)} must be at least ${rule.min}.`;
        else if (rule.max !== undefined && parsed > rule.max)
          details[field] = `${label(field)} must be ${rule.max} or less.`;
        else value[field] = parsed;
        break;
      }

      case 'boolean':
        value[field] = raw === true || raw === 'true';
        break;

      case 'array':
        if (!Array.isArray(raw)) details[field] = `${label(field)} must be a list.`;
        else if (rule.min && raw.length < rule.min)
          details[field] = `Add at least ${rule.min} ${rule.min === 1 ? 'entry' : 'entries'}.`;
        else value[field] = raw;
        break;

      case 'object':
        if (typeof raw !== 'object' || Array.isArray(raw))
          details[field] = `${label(field)} must be an object.`;
        else value[field] = raw;
        break;

      case 'email': {
        const text = String(raw).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text))
          details[field] = 'Enter a valid email address.';
        else value[field] = text;
        break;
      }

      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw)))
          details[field] = `${label(field)} must be a YYYY-MM-DD date.`;
        else value[field] = String(raw);
        break;

      default: {
        const text = String(raw).trim();
        if (rule.minLength && text.length < rule.minLength)
          details[field] = `${label(field)} must be at least ${rule.minLength} characters.`;
        else if (rule.pattern && !rule.pattern.test(text))
          details[field] = rule.message ?? `${label(field)} is not in the expected format.`;
        else if (rule.oneOf && !rule.oneOf.includes(text))
          details[field] = `${label(field)} must be one of: ${rule.oneOf.join(', ')}.`;
        else value[field] = text;
      }
    }
  }

  if (Object.keys(details).length) {
    throw badRequest('Some fields need attention.', details);
  }

  return value;
}

/** `emergencyContactName` reads back to the user as "Emergency contact name". */
function label(field) {
  const words = field.replace(/([A-Z])/g, ' $1').trim();
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}
