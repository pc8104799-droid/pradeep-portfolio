import { inject, Injectable, signal } from '@angular/core';
import { API_BASE_URL } from '../api/api.service';

const TOKEN_KEY = 'medicare360-token';

/**
 * Holds the access token, and nothing else.
 *
 * It is separate from `AuthService` on purpose: the HTTP interceptor needs the
 * token, and `AuthService` needs the HTTP client, so putting both in one service
 * would be a dependency cycle. This one has no HTTP dependency at all.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly base = inject(API_BASE_URL);
  private readonly _token = signal<string | null>(read());

  readonly token = this._token.asReadonly();

  set(token: string): void {
    this._token.set(token);

    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Private mode: the session lives until this tab closes.
    }
  }

  clear(): void {
    this._token.set(null);

    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  /** True only for our own API, so the token is never sent anywhere else. */
  isOwnApi(url: string): boolean {
    if (url.startsWith('/')) return true;

    try {
      return new URL(url, location.href).origin === new URL(this.base, location.href).origin;
    } catch {
      return false;
    }
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
