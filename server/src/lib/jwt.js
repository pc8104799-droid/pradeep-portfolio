import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const HEADER = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

/** Signs a compact JWS. Payload gains `iat` and `exp`. */
export function signToken(payload, ttlSeconds = config.tokenTtlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = base64Url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const unsigned = `${HEADER}.${body}`;

  return `${unsigned}.${sign(unsigned)}`;
}

/**
 * Verifies signature and expiry. Returns the claims, or null for anything that
 * does not check out — callers never get a partially trusted token.
 */
export function verifyToken(token) {
  if (typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = Buffer.from(sign(`${header}.${body}`));
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

function sign(value) {
  return createHmac('sha256', config.secret).update(value).digest('base64url');
}

function base64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}
