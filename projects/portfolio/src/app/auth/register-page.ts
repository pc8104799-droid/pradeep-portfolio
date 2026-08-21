import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@pc/core';
import { Icon } from '@pc/ui';

/** Both password fields must agree before the form can be submitted. */
const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };

@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './register-page.html',
  styleUrl: './auth-card.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  /** Rough strength read-out — length plus variety of character classes. */
  protected readonly strength = computed(() => {
    const value = this.passwordValue();
    let score = 0;

    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;

    return score;
  });

  protected readonly strengthLabel = computed(
    () => ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][this.strength()],
  );

  private readonly passwordValue = signal('');

  constructor() {
    this.form.controls.password.valueChanges.subscribe((value) =>
      this.passwordValue.set(value ?? ''),
    );
  }

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
      await this.router.navigateByUrl('/dashboard');
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : 'Could not create the account.');
    } finally {
      this.busy.set(false);
    }
  }

  protected invalid(control: 'name' | 'email' | 'password' | 'confirm'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }

  protected get mismatch(): boolean {
    const confirm = this.form.controls.confirm;
    return this.form.hasError('mismatch') && (confirm.touched || confirm.dirty);
  }
}
