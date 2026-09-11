import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import type {
  AuthSession,
  Doctor,
  HospitalBranch,
  Panel,
  Patient,
  Role,
  SessionUser,
} from '../models/medicare.models';
import { TokenStore } from './token.store';

/** What the sign-in screen shows so nobody has to be told the demo password. */
export interface DemoAccount {
  readonly role: Role;
  readonly email: string;
  readonly name: string;
}

/**
 * The session.
 *
 * Roles are enforced by the API — this service exists so the UI knows which
 * shell to render and which links to show. The token is the only credential;
 * the profile hanging off it is a convenience copy of the signed-in patient,
 * doctor or branch record.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStore);

  private readonly _user = signal<SessionUser | null>(null);
  private readonly _profile = signal<Patient | Doctor | HospitalBranch | null>(null);
  private readonly _restoring = signal(this.tokens.token() !== null);

  readonly user = this._user.asReadonly();
  readonly profile = this._profile.asReadonly();

  /** True while the stored token is being exchanged for an account on boot. */
  readonly restoring = this._restoring.asReadonly();

  readonly signedIn = computed(() => this._user() !== null);
  readonly role = computed<Role | null>(() => this._user()?.role ?? null);

  /** The patient or doctor id every scoped request is built from. */
  readonly profileId = computed(() => this._user()?.profileId ?? null);

  readonly patient = computed(() =>
    this._user()?.role === 'patient' ? (this._profile() as Patient | null) : null,
  );

  readonly doctor = computed(() =>
    this._user()?.role === 'doctor' ? (this._profile() as Doctor | null) : null,
  );

  /**
   * The panel this account works in — also the URL prefix for its routes, so
   * shared screens (notifications, QR, settings) can build their own links.
   */
  readonly panel = computed<Panel>(() => {
    switch (this._user()?.role) {
      case 'doctor':
        return 'doctor';
      case 'admin':
        return 'admin';
      case 'pharmacy':
        return 'pharmacy';
      default:
        return 'patient';
    }
  });

  /** Where a signed-in account belongs when it lands on `/`. */
  readonly homeRoute = computed(() =>
    this._user() ? `/${this.panel()}/dashboard` : '/login',
  );

  /** The branch a reception or pharmacy account is signed in at. */
  readonly branch = computed(() =>
    this.has('admin', 'pharmacy') ? (this._profile() as HospitalBranch | null) : null,
  );

  /**
   * Re-establishes the session from the stored token. Called once at bootstrap
   * so a refresh does not bounce a signed-in user back to the login screen.
   */
  async restore(): Promise<void> {
    if (!this.tokens.token()) {
      this._restoring.set(false);
      return;
    }

    try {
      const { user, profile } = await this.api.get<{
        user: SessionUser;
        profile: Patient | Doctor | HospitalBranch | null;
      }>('/auth/me');

      this._user.set(user);
      this._profile.set(profile);
    } catch {
      // An expired or tampered token: the error interceptor has already
      // cleared it, so start as a visitor.
      this._user.set(null);
      this._profile.set(null);
    } finally {
      this._restoring.set(false);
    }
  }

  async login(email: string, password: string): Promise<SessionUser> {
    return this.accept(await this.api.post<AuthSession>('/auth/login', { email, password }));
  }

  /** Patient self-registration — the full intake form. */
  async register(form: Record<string, unknown>): Promise<SessionUser> {
    return this.accept(await this.api.post<AuthSession>('/auth/register', form));
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.api.patch('/auth/password', { currentPassword, newPassword });
  }

  logout(): void {
    this.tokens.clear();
    this._user.set(null);
    this._profile.set(null);
  }

  demoAccounts(): Promise<{ password: string; accounts: DemoAccount[] }> {
    return this.api.get('/auth/demo-accounts');
  }

  /** Keeps the cached profile in step after the profile screen saves. */
  updateProfile(profile: Patient | Doctor): void {
    this._profile.set(profile);

    const user = this._user();
    if (user && 'name' in profile) this._user.set({ ...user, name: profile.name });
  }

  has(...roles: Role[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  private accept(session: AuthSession): SessionUser {
    this.tokens.set(session.token);
    this._user.set(session.user);
    this._profile.set(session.profile);
    this._restoring.set(false);

    return session.user;
  }
}
