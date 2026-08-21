import { computed, Injectable, signal } from '@angular/core';

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** Base64 PBKDF2 salt. */
  readonly salt: string;
  /** Base64 PBKDF2 derived key. */
  readonly hash: string;
  readonly createdAt: string;
}

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

const ACCOUNTS_KEY = 'pc-accounts';
const SESSION_KEY = 'pc-session';
const ITERATIONS = 150_000;

/**
 * Client-side account gate.
 *
 * IMPORTANT: this is not authentication. There is no server, so accounts and the
 * session live in this browser's localStorage and anyone with devtools can read
 * or forge them. Passwords are never stored — only a PBKDF2-SHA-256 derivation
 * with a per-account salt — so a shared machine does not leak the password
 * itself, but the gate is a convenience, not a security boundary. Anything that
 * genuinely needs protecting has to be enforced by a backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<SessionUser | null>(this.readSession());

  readonly user = this._user.asReadonly();
  readonly signedIn = computed(() => this._user() !== null);
  /** True when nobody has registered yet — the UI sends them to sign-up. */
  readonly hasAccounts = signal(this.readAccounts().length > 0);

  async register(name: string, email: string, password: string): Promise<SessionUser> {
    const normalised = email.trim().toLowerCase();
    const accounts = this.readAccounts();

    if (accounts.some((account) => account.email === normalised)) {
      throw new Error('An account with that email already exists. Try signing in.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const account: Account = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalised,
      salt: toBase64(salt),
      hash: toBase64(await derive(password, salt)),
      createdAt: new Date().toISOString(),
    };

    this.writeAccounts([...accounts, account]);
    this.hasAccounts.set(true);

    return this.startSession(account);
  }

  async login(email: string, password: string): Promise<SessionUser> {
    const normalised = email.trim().toLowerCase();
    const account = this.readAccounts().find((entry) => entry.email === normalised);

    // Same message either way, so the form cannot be used to discover which
    // addresses have accounts.
    const failure = new Error('Those details do not match an account.');

    if (!account) {
      throw failure;
    }

    const derived = toBase64(await derive(password, fromBase64(account.salt)));
    if (derived !== account.hash) {
      throw failure;
    }

    return this.startSession(account);
  }

  logout(): void {
    this._user.set(null);

    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  /** Used by the sign-up screen to warn before shadowing an existing account. */
  emailTaken(email: string): boolean {
    const normalised = email.trim().toLowerCase();
    return this.readAccounts().some((account) => account.email === normalised);
  }

  private startSession(account: Account): SessionUser {
    const user: SessionUser = { id: account.id, name: account.name, email: account.email };
    this._user.set(user);

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch {
      // The session simply will not survive a refresh.
    }

    return user;
  }

  private readAccounts(): Account[] {
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Account[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeAccounts(accounts: Account[]): void {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      throw new Error('This browser is blocking storage, so accounts cannot be saved.');
    }
  }

  private readSession(): SessionUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }
}

/** PBKDF2-SHA-256. Web Crypto only — no dependency, no rolled-own hashing. */
async function derive(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
}

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
