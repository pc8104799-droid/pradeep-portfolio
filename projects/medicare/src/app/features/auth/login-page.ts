import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ActionState,
  asyncState,
  AuthService,
  NotificationService,
  ToastService,
  type DemoAccount,
} from '@pc/medicare-core';
import { FieldError } from '../../shared/ui/controls';
import { AuthLayout } from './auth-layout';

/**
 * Sign-in.
 *
 * The demo accounts are fetched from the API and offered as one-click fills.
 * Without that, nobody can get past this screen without reading a README —
 * and a portfolio reviewer will not.
 */
@Component({
  selector: 'mc-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TitleCasePipe, FieldError, AuthLayout],
  template: `
    <mc-auth-layout
      heading="Sign in to MediCare360"
      blurb="Appointments, prescriptions, lab reports, medicines and payments — one record, for patients and for the clinic."
    >
      <form class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (action.error(); as error) {
          <p class="note note--danger" role="alert">{{ error.message }}</p>
        }

        <label class="field" [class.is-invalid]="invalid('email')">
          <span class="field__label">Email <span class="req">*</span></span>
          <input
            type="email"
            formControlName="email"
            autocomplete="username"
            placeholder="you@example.com"
            [attr.aria-invalid]="invalid('email')"
          />
          <mc-field-error [control]="form.controls.email" label="Email" />
        </label>

        <label class="field" [class.is-invalid]="invalid('password')">
          <span class="field__label">Password <span class="req">*</span></span>
          <input
            [type]="reveal() ? 'text' : 'password'"
            formControlName="password"
            autocomplete="current-password"
            placeholder="••••••••"
          />
          <mc-field-error [control]="form.controls.password" label="Password" />
        </label>

        <label class="check">
          <input type="checkbox" [checked]="reveal()" (change)="reveal.set(!reveal())" />
          <span class="text-sm">Show password</span>
        </label>

        <button type="submit" class="btn btn--primary btn--lg btn--block" [disabled]="action.busy()">
          @if (action.busy()) {
            <span class="btn__spinner" aria-hidden="true"></span>
          }
          Sign in
        </button>

        <p class="text-sm muted">
          New patient? <a class="link" routerLink="/register">Create your record</a> — it takes a minute.
        </p>
      </form>

      <div slot="aside" class="demo card card--pad">
        <h2 class="demo__title">Demo accounts</h2>
        <p class="text-sm muted">
          This is a portfolio build with seeded data. Pick a role to fill the form.
        </p>

        @if (demo.error()) {
          <p class="note note--warning">
            The API is not running. Start it with <code class="mono">npm run api</code>, then reload.
          </p>
        } @else if (demo.busy()) {
          <div class="skeleton" style="height: 8rem"></div>
        } @else if (demo.data(); as info) {
          <ul class="demo__list">
            @for (account of info.accounts; track account.email) {
              <li>
                <button type="button" class="demo__account" (click)="useDemo(account, info.password)">
                  <strong>{{ account.role | titlecase }}</strong>
                  <span class="muted text-xs">{{ account.email }}</span>
                </button>
              </li>
            }
          </ul>

          <p class="text-xs muted">
            Shared password <code class="mono">{{ info.password }}</code>
          </p>
        }
      </div>
    </mc-auth-layout>
  `,
  styles: `
    .link {
      color: var(--primary);
      font-weight: 600;
    }

    .note {
      display: block;
      padding: 0.65rem 0.8rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
    }

    .note--danger {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .note--warning {
      background: var(--warning-soft);
      color: var(--warning);
    }

    .demo {
      display: grid;
      gap: 0.6rem;
      align-content: start;
    }

    .demo__title {
      font-size: 0.9rem;
    }

    .demo__list {
      display: grid;
      gap: 0.35rem;
    }

    .demo__account {
      display: grid;
      gap: 0.05rem;
      width: 100%;
      padding: 0.5rem 0.65rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--stroke);
      background: var(--surface);
      text-align: left;
      transition:
        border-color var(--t) var(--ease),
        background var(--t) var(--ease);
    }

    .demo__account:hover {
      border-color: var(--primary);
      background: var(--primary-soft);
    }

    .demo__account strong {
      font-family: var(--font-display);
      font-size: 0.86rem;
    }

    code {
      padding: 0.05rem 0.3rem;
      border-radius: var(--radius-xs);
      background: var(--surface-3);
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly notifications = inject(NotificationService);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly action = new ActionState();
  protected readonly reveal = signal(false);
  protected readonly demo = asyncState(() => this.auth.demoAccounts());

  protected invalid(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  protected useDemo(account: DemoAccount, password: string): void {
    this.form.setValue({ email: account.email, password });
    this.form.markAsPristine();
    this.action.clear();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    const user = await this.action.run(() => this.auth.login(email, password));
    if (!user) return;

    void this.notifications.refreshUnread();

    // Honour where the guard was trying to send them, if anywhere.
    const next = new URLSearchParams(location.search).get('next');
    await this.router.navigateByUrl(next ?? this.auth.homeRoute());

    this.toasts.success(
      `Welcome back, ${user.name.split(' ')[0]}`,
      `Signed in as ${user.role} · ${user.profileId}`,
    );
  }
}
