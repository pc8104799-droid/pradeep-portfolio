import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ActionState,
  AuthService,
  lazyState,
  PatientService,
  PharmacyService,
  ToastService,
  type BasketQuote,
} from '@pc/medicare-core';
import { MC_ATOMS } from '../../shared/ui/atoms';
import { FieldError } from '../../shared/ui/controls';
import { DataState } from '../../shared/ui/data-state';
import { MC_PIPES } from '../../shared/pipes';

const SLOTS = [
  'Today, 2 – 5 pm',
  'Today, 6 – 9 pm',
  'Tomorrow, 9 am – 12 pm',
  'Tomorrow, 2 – 5 pm',
  'Collect from the pharmacy counter',
];

/**
 * Checkout.
 *
 * Address, then slot, then place the order — which creates the order and its
 * pending payment and hands off to the payment screen. The order exists before
 * the money does, on purpose: an abandoned payment leaves a visible order the
 * patient can pay for or cancel, not a silent gap.
 */
@Component({
  selector: 'mc-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, DataState, FieldError, ...MC_ATOMS, ...MC_PIPES],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.scss',
})
export class CheckoutPage {
  protected readonly cart = inject(PharmacyService);

  private readonly patients = inject(PatientService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly slots = SLOTS;
  protected readonly action = new ActionState();
  protected readonly addressAction = new ActionState();

  protected readonly addressId = signal('');
  protected readonly slot = signal(SLOTS[1]);
  protected readonly addingAddress = signal(false);

  private readonly patientId = this.auth.profileId() ?? '';

  protected readonly quote = lazyState<BasketQuote | null>(async () =>
    this.cart.isEmpty() ? null : this.cart.quote(),
  );

  protected readonly addresses = lazyState(() => this.patients.addresses(this.patientId));

  protected readonly canPlace = computed(() => {
    const quote = this.quote.data();
    return (
      !!quote &&
      quote.lines.length > 0 &&
      quote.blocked.length === 0 &&
      quote.outOfStock.length === 0 &&
      !!this.addressId()
    );
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    label: ['Home'],
    name: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^[+0-9 ()-]{10,18}$/)]],
    line1: ['', [Validators.required, Validators.minLength(5)]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    landmark: [''],
  });

  constructor() {
    void this.quote.load();

    void this.addresses.load().then((result) => {
      const list = result?.items ?? [];
      // Default to the address already marked default, else the first one.
      this.addressId.set((list.find((address) => address.isDefault) ?? list[0])?.id ?? '');

      if (!list.length) this.addingAddress.set(true);
    });
  }

  protected control(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  protected async saveAddress(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const saved = await this.addressAction.run(() =>
      this.patients.addAddress(this.patientId, this.form.getRawValue()),
    );

    if (!saved) return;

    this.addingAddress.set(false);
    this.form.reset({ label: 'Home' });
    this.addressId.set(saved.id);
    this.toasts.success('Address saved');

    void this.addresses.load();
  }

  protected async place(): Promise<void> {
    const placed = await this.action.run(() => this.cart.place(this.addressId(), this.slot()));
    if (!placed) return;

    // The basket has become an order; anything left in it would be a ghost.
    this.cart.clear();

    this.toasts.info('Order placed', 'Complete the payment to send it to the pharmacy.');
    await this.router.navigate(['/patient/pay', placed.payment.id]);
  }
}
