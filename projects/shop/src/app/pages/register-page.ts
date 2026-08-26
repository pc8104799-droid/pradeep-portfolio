import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@pc/core';
import { CatalogService } from '@pc/shop-core';

@Component({
  selector: 'shop-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class ShopRegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly catalog = inject(CatalogService);

  /** Widened so both pages can share one template. */
  protected readonly mode: 'login' | 'register' = 'register';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly noAccounts = false;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set('');

    const { name, email, password } = this.form.getRawValue();

    try {
      await this.auth.register(name, email, password);
      await this.router.navigateByUrl(this.nextUrl());
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : 'Could not create the account.');
    } finally {
      this.busy.set(false);
    }
  }

  protected invalid(control: 'name' | 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }

  private nextUrl(): string {
    const next = new URLSearchParams(location.search).get('next');
    return next && next.startsWith('/') ? next : '/';
  }
}
