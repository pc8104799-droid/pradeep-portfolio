import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(pbkdf2);
const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

/**
 * PBKDF2-SHA-256 with a per-account salt. Not as slow as argon2/bcrypt, but it
 * ships with Node, so the project has no native build step — and it is still a
 * real KDF rather than a bare hash.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;

  const [scheme, iterations, salt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterations || !salt || !expected) return false;

  const key = await derive(
    password,
    Buffer.from(salt, 'base64'),
    Number(iterations),
    KEY_LENGTH,
    DIGEST,
  );
  const expectedBuffer = Buffer.from(expected, 'base64');

  // Constant-time so a wrong password cannot be narrowed down by timing.
  return key.length === expectedBuffer.length && timingSafeEqual(key, expectedBuffer);
}
