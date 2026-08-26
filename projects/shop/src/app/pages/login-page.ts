import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@pc/core';
import { CatalogService } from '@pc/shop-core';

@Component({
  selector: 'shop-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class ShopLoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly catalog = inject(CatalogService);

  /** Widened so both pages can share one template. */
  protected readonly mode: 'login' | 'register' = 'login';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly noAccounts = !this.auth.hasAccounts();

  protected readonly form = this.fb.nonNullable.group({
    name: [''],
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
      await this.router.navigateByUrl(this.nextUrl());
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      this.busy.set(false);
    }
  }

  protected invalid(control: 'name' | 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }

  /** Honours ?next= from the guard, defaulting to the store. */
  private nextUrl(): string {
    const next = new URLSearchParams(location.search).get('next');
    return next && next.startsWith('/') ? next : '/';
  }
}
