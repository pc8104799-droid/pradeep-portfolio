/**
 * The only error type route handlers should throw. Anything else that escapes a
 * handler is treated as a 500 by the error middleware, which is the point: an
 * unexpected crash must never be reported to the client as a tidy 400.
 */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Sign in to continue.') => new HttpError(401, message);
export const forbidden = (message = 'You do not have access to this resource.') =>
  new HttpError(403, message);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);
