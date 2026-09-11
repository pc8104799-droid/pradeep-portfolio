import { createApp } from './app.js';
import { config } from './config.js';
import { store } from './db/store.js';

/** Boots the store, then starts listening. Nothing serves before data is ready. */
const { seeded, reason } = await store.init();

if (seeded) {
  console.log(
    `Seeded a fresh database at ${config.dbFile}` +
      (reason === 'unreadable' ? ' (the previous file could not be parsed).' : '.'),
  );
}

const app = createApp();

app.listen(config.port, config.host, () => {
  const counts = store.summary();

  console.log('');
  console.log('  MediCare360 API');
  console.log(`  http://${config.host}:${config.port}/api`);
  console.log('');
  console.log(`  ${counts.patients} patients · ${counts.doctors} doctors · ${counts.appointments} appointments · ${counts.medicines} medicines`);
  console.log(`  Demo sign-in — any seeded email, password: ${config.demoPassword}`);
  console.log('');

  if (config.secretIsDefault) {
    console.warn('  ! Using the built-in token secret. Set MEDICARE_SECRET before deploying anywhere real.');
    console.log('');
  }
});

// A clean exit still flushes whatever the last request changed.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await store.flush().catch(() => {});
    process.exit(0);
  });
}
