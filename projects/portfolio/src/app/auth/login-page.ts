import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@pc/core';
import { Icon } from '@pc/ui';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './login-page.html',
  styleUrl: './auth-card.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  /** Nobody has registered on this browser yet. */
  protected readonly noAccounts = !this.auth.hasAccounts();

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set('');

    const { email, password } = this.form.getRawValue();

    try {
      await this.auth.login(email, password);
      const next = new URLSearchParams(location.search).get('next');
      await this.router.navigateByUrl(next && next.startsWith('/') ? next : '/dashboard');
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      this.busy.set(false);
    }
  }

  protected invalid(control: 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }
}
