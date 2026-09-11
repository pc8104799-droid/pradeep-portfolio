import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from '../models/medicare.models';

/**
 * One error type for every failed call.
 *
 * The API always answers a failure as `{ error: { status, message, details? } }`,
 * so screens can show `error.message` directly and forms can read
 * `error.details` to mark the exact controls that were rejected. A network
 * failure is normalised into the same shape rather than leaking an
 * `HttpErrorResponse` into a template.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details: Readonly<Record<string, string>>;

  constructor(status: number, message: string, details: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** True when the caller should be sent back to the sign-in screen. */
  get isAuthFailure(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** True when the field-level `details` are worth rendering on a form. */
  get hasFieldErrors(): boolean {
    return Object.keys(this.details).length > 0;
  }

  static from(response: HttpErrorResponse): ApiError {
    // status 0 means the request never reached a server at all.
    if (response.status === 0) {
      return new ApiError(
        0,
        'Cannot reach the MediCare360 API. Start it with `npm run api` and try again.',
      );
    }

    const body = response.error as ApiErrorBody | string | null;

    if (body && typeof body === 'object' && 'error' in body && body.error) {
      return new ApiError(body.error.status ?? response.status, body.error.message, {
        ...(body.error.details ?? {}),
      });
    }

    return new ApiError(response.status, FALLBACKS[response.status] ?? response.statusText ?? 'Request failed.');
  }
}

/** Plain-language stand-ins for a server that answered without a body. */
const FALLBACKS: Record<number, string> = {
  400: 'Some of that could not be accepted. Check the form and try again.',
  401: 'Your session has expired. Sign in again to continue.',
  403: 'You do not have access to that.',
  404: 'We could not find what you were looking for.',
  409: 'Someone else changed that first. Refresh and try again.',
  429: 'Too many requests. Wait a moment and try again.',
  500: 'Something went wrong on the server.',
  503: 'The service is temporarily unavailable.',
};
