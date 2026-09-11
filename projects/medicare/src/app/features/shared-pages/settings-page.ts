import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import {
  ActionState,
  AuthService,
  ThemeService,
  ToastService,
  type Density,
  type ThemeId,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { FieldError } from '../../shared/ui/controls';

/**
 * Appearance and security.
 *
 * The theme picker is a real feature rather than a toggle in a menu: a ward
 * screen at night, a reception desk under fluorescent light and a patient with
 * low vision all want different things, and the choice is remembered per
 * browser.
 */
@Component({
  selector: 'mc-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldError, ...MC_ATOMS],
  template: `
    <section class="page">
      <header class="page__head">
        <div>
          <h1>Appearance & security</h1>
          <p>How MediCare360 looks on this device, and the password you sign in with.</p>
        </div>
      </header>

      <div class="split split--even">
        <article class="card card--pad stack">
          <h2>Theme</h2>
          <p class="text-sm muted">
            Applies to every screen in both panels, and is remembered on this browser.
          </p>

          <div class="themes">
            @for (option of theme.options; track option.id) {
              <button
                type="button"
                class="theme"
                [class.is-active]="theme.theme() === option.id"
                [attr.aria-pressed]="theme.theme() === option.id"
                (click)="choose(option.id)"
              >
                <span
                  class="theme__swatch"
                  [style.--a]="option.swatch[0]"
                  [style.--b]="option.swatch[1]"
                  aria-hidden="true"
                ></span>

                <span class="theme__text">
                  <strong>{{ option.name }}</strong>
                  <span class="muted text-xs">{{ option.hint }}</span>
                </span>

                @if (theme.theme() === option.id) {
                  <span class="theme__check" aria-hidden="true">✓</span>
                }
              </button>
            }
          </div>

          <hr class="divider" />

          <h2>Density</h2>
          <p class="text-sm muted">
            Compact tightens padding and row height — useful on a reception desk where the tables
            matter more than the whitespace.
          </p>

          <div class="row row--wrap">
            @for (option of densities; track option.id) {
              <button
                type="button"
                class="chip"
                [class.is-active]="theme.density() === option.id"
                (click)="theme.setDensity(option.id)"
              >
                {{ option.label }}
              </button>
            }
          </div>

          <mc-note tone="info">
            Themes are built from CSS custom properties, so every component adapts without knowing
            which theme is running — including the one you have not tried yet.
          </mc-note>
        </article>

        <article class="card card--pad stack">
          <h2>Change your password</h2>

          <form class="stack" [formGroup]="form" (ngSubmit)="save()" novalidate>
            @if (action.error(); as error) {
              <p class="note note--danger" role="alert">{{ error.message }}</p>
            }

            <label class="field" [class.is-invalid]="invalid('currentPassword')">
              <span class="field__label">Current password <span class="req">*</span></span>
              <input type="password" formControlName="currentPassword" autocomplete="current-password" />
              <mc-field-error [control]="control('currentPassword')" label="Current password" />
            </label>

            <label class="field" [class.is-invalid]="invalid('newPassword')">
              <span class="field__label">New password <span class="req">*</span></span>
              <input type="password" formControlName="newPassword" autocomplete="new-password" />
              <mc-field-error
                [control]="control('newPassword')"
                label="New password"
                [serverError]="action.fieldErrors()['newPassword']"
              />
              <span class="field__hint">At least 8 characters.</span>
            </label>

            <label class="field" [class.is-invalid]="form.errors?.['mismatch'] && control('confirm').touched">
              <span class="field__label">Confirm new password <span class="req">*</span></span>
              <input type="password" formControlName="confirm" autocomplete="new-password" />
              @if (form.errors?.['mismatch'] && control('confirm').touched) {
                <p class="field__error" role="alert">Those two passwords do not match.</p>
              }
            </label>

            <button type="submit" class="btn btn--primary" [disabled]="action.busy()">
              @if (action.busy()) {
                <span class="btn__spinner" aria-hidden="true"></span>
              }
              Update password
            </button>
          </form>

          <hr class="divider" />

          <h2>Session</h2>

          <div class="kv">
            <div class="kv__row">
              <span class="kv__key">Signed in as</span>
              <span class="kv__value">{{ auth.user()?.name }}</span>
            </div>
            <div class="kv__row">
              <span class="kv__key">Email</span>
              <span class="kv__value">{{ auth.user()?.email }}</span>
            </div>
            <div class="kv__row">
              <span class="kv__key">Role</span>
              <span class="kv__value">{{ auth.role() }}</span>
            </div>
            <div class="kv__row">
              <span class="kv__key">Profile ID</span>
              <span class="kv__value mono">{{ auth.profileId() }}</span>
            </div>
          </div>

          <mc-note tone="warning">
            Demo accounts are shared. Changing a demo password will change it for everyone using
            this build, so the sign-in screen may stop matching what it prints.
          </mc-note>
        </article>
      </div>
    </section>
  `,
  styles: `
    h2 {
      font-size: 1rem;
    }

    .themes {
      display: grid;
      gap: 0.45rem;
    }

    .theme {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.6rem 0.75rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--stroke);
      background: var(--surface);
      text-align: left;
      transition: all var(--t) var(--ease);
    }

    .theme:hover {
      border-color: var(--stroke-strong);
    }

    .theme.is-active {
      border-color: var(--primary);
      background: var(--primary-soft);
    }

    .theme__swatch {
      width: 2.2rem;
      height: 2.2rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--stroke-strong);
      background: linear-gradient(135deg, var(--a) 50%, var(--b) 50%);
      flex: none;
    }

    .theme__text {
      display: grid;
      min-width: 0;
    }

    .theme__text strong {
      font-family: var(--font-display);
      font-size: 0.9rem;
    }

    .theme__check {
      margin-left: auto;
      color: var(--primary);
      font-weight: 700;
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
  `,
})
export class SettingsPage {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  private readonly toasts = inject(ToastService);

  protected readonly action = new ActionState();

  protected readonly densities: readonly { id: Density; label: string }[] = [
    { id: 'comfortable', label: 'Comfortable' },
    { id: 'compact', label: 'Compact' },
  ];

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    {
      validators: [
        (group: AbstractControl) =>
          group.get('confirm')?.value && group.get('newPassword')?.value !== group.get('confirm')?.value
            ? { mismatch: true }
            : null,
      ],
    },
  );

  protected control(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  protected invalid(name: string): boolean {
    const control = this.control(name);
    return control.invalid && (control.dirty || control.touched);
  }

  protected choose(theme: ThemeId): void {
    this.theme.set(theme);
    this.toasts.info(`${this.theme.current().name} theme applied`);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    const done = await this.action.run(() => this.auth.changePassword(currentPassword, newPassword));

    // `changePassword` resolves to void, so success is "no error was recorded".
    if (done === null && this.action.error()) return;

    this.form.reset();
    this.toasts.success('Password updated', 'Use it the next time you sign in.');
  }
}
