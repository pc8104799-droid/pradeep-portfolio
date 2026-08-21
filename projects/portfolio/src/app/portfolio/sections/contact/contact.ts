import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContentService } from '@pc/core';
import { MagneticDirective } from '@pc/ui';
import { RevealDirective } from '@pc/ui';
import { Icon } from '@pc/ui';
import { SectionHeading } from '@pc/ui';

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, SectionHeading, RevealDirective, MagneticDirective],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class Contact {
  private readonly fb = inject(FormBuilder);

  private readonly content = inject(ContentService);

  protected get profile() {
    return this.content.profile();
  }

  protected get socials() {
    return this.content.socials();
  }

  protected readonly copied = signal(false);
  protected readonly sent = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', [Validators.required, Validators.minLength(3)]],
    message: ['', [Validators.required, Validators.minLength(20)]],
  });

  /**
   * There is no backend behind this site, so the form composes a pre-filled
   * message and hands it to the visitor's mail client — no silent failures and
   * nothing to keep running.
   */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, subject, message } = this.form.getRawValue();
    const target = this.profile.email;
    const body = `${message}\n\n—\n${name}\n${email}`;
    const href =
      `mailto:${target}` +
      `?subject=${encodeURIComponent(`[Portfolio] ${subject}`)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = href;

    this.sent.set(true);
    this.form.reset();
    setTimeout(() => this.sent.set(false), 6000);
  }

  protected async copyEmail(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.profile.email);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2200);
    } catch {
      // Clipboard access can be blocked — the address is on screen either way.
    }
  }

  protected invalid(control: 'name' | 'email' | 'subject' | 'message'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }

  protected errorFor(control: 'name' | 'email' | 'subject' | 'message'): string {
    const field = this.form.controls[control];

    if (field.hasError('required')) {
      return 'This one is required.';
    }
    if (field.hasError('email')) {
      return 'That does not look like an email address.';
    }
    if (field.hasError('minlength')) {
      const min = field.getError('minlength').requiredLength as number;
      return `A little longer please — at least ${min} characters.`;
    }

    return '';
  }
}
