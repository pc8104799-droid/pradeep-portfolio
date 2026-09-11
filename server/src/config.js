import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Everything the server reads from the environment, resolved once. */
export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  host: process.env['HOST'] ?? '127.0.0.1',

  /** Where the JSON document store lives. */
  dbFile: resolve(process.env['DB_FILE'] ?? join(here, '..', 'data', 'db.json')),

  /**
   * Token signing key. A demo default keeps `npm start` working with no setup;
   * a real deployment must set MEDICARE_SECRET, and the server says so on boot.
   */
  secret: process.env['MEDICARE_SECRET'] ?? 'medicare360-development-secret',
  secretIsDefault: !process.env['MEDICARE_SECRET'],

  /** Access tokens last a working day — long enough to demo a whole flow. */
  tokenTtlSeconds: Number(process.env['TOKEN_TTL'] ?? 60 * 60 * 8),

  /** Browsers allowed to call the API. `*` in development. */
  origins: (process.env['CORS_ORIGIN'] ?? '*').split(',').map((value) => value.trim()),

  /** Seeded demo accounts all share this password, and it is printed on boot. */
  demoPassword: process.env['DEMO_PASSWORD'] ?? 'Medicare@360',
};
