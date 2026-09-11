import { HttpError } from '../lib/http-error.js';

/** Anything that fell through the router is a 404 in the same envelope. */
export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `No route matches ${req.method} ${req.originalUrl}.`));
}

/**
 * The single response shape for every failure:
 * `{ error: { status, message, details? } }`.
 *
 * Only `HttpError` reaches the client with its own message. An unexpected throw
 * is logged in full and reported as a generic 500, so a stack trace or a store
 * internal never leaks into a browser.
 */
export function errorHandler(error, req, res, _next) {
  const known = error instanceof HttpError;
  const status = known ? error.status : 500;

  if (!known) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  res.status(status).json({
    error: {
      status,
      message: known ? error.message : 'Something went wrong on the server.',
      ...(known && error.details ? { details: error.details } : {}),
    },
  });
}

/**
 * Express 5 forwards a rejected promise to the error handler on its own, but
 * wrapping keeps the intent explicit and survives a downgrade to Express 4.
 */
export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
