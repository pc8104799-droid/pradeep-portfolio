import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { readSession } from './middleware/auth.js';
import { api } from './routes/index.js';

/**
 * The Express application, separated from the listener so a test can import it
 * and drive it without binding a port.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.origins.includes('*') ? true : config.origins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  // One line per request, with the status and how long it took. Enough to see
  // what the Angular app is doing without reaching for a logging library.
  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const marker = res.statusCode >= 500 ? '!!' : res.statusCode >= 400 ? ' !' : '  ';
      console.log(`${marker} ${res.statusCode} ${req.method.padEnd(6)} ${req.originalUrl} ${ms.toFixed(1)}ms`);
    });

    next();
  });

  app.use(readSession);
  app.use('/api', api);

  app.get('/', (_req, res) => {
    res.json({
      name: 'MediCare360 API',
      docs: '/api/health',
      hint: 'Every endpoint lives under /api.',
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
