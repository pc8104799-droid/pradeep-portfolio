import { computed, effect, Injectable, signal } from '@angular/core';
import type { Address } from '../models/shop.models';

const STORAGE_KEY = 'freshkart-addresses';
const SELECTED_KEY = 'freshkart-address-selected';

/** Saved delivery addresses, kept in this browser. */
@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly _addresses = signal<Address[]>(this.restore());
  private readonly _selectedId = signal<string | null>(this.restoreSelected());

  readonly addresses = this._addresses.asReadonly();

  readonly selected = computed<Address | null>(() => {
    const list = this._addresses();
    return list.find((address) => address.id === this._selectedId()) ?? list[0] ?? null;
  });

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._addresses()));
        const selected = this._selectedId();
        if (selected) {
          localStorage.setItem(SELECTED_KEY, selected);
        }
      } catch {
        // Addresses just will not persist.
      }
    });
  }

  save(address: Omit<Address, 'id'> & { id?: string }): Address {
    const existing = address.id
      ? this._addresses().find((entry) => entry.id === address.id)
      : undefined;

    const saved: Address = { ...address, id: existing?.id ?? `addr_${crypto.randomUUID().slice(0, 8)}` };

    this._addresses.update((list) =>
      existing ? list.map((entry) => (entry.id === saved.id ? saved : entry)) : [...list, saved],
    );

    this._selectedId.set(saved.id);
    return saved;
  }

  remove(id: string): void {
    this._addresses.update((list) => list.filter((address) => address.id !== id));

    if (this._selectedId() === id) {
      this._selectedId.set(this._addresses()[0]?.id ?? null);
    }
  }

  select(id: string): void {
    this._selectedId.set(id);
  }

  /** Field-level validation, shared by the checkout form. */
  validate(address: Partial<Address>): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!address.name || address.name.trim().length < 2) {
      errors['name'] = 'Enter the name for this delivery.';
    }

    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test((address.phone ?? '').replace(/\s+/g, ''))) {
      errors['phone'] = 'Enter a 10-digit Indian mobile number.';
    }

    if (!address.line1 || address.line1.trim().length < 4) {
      errors['line1'] = 'Flat, building and street help the rider find you.';
    }

    if (!address.city || address.city.trim().length < 2) {
      errors['city'] = 'Enter the city.';
    }

    if (!/^\d{6}$/.test((address.pincode ?? '').trim())) {
      errors['pincode'] = 'A PIN code is 6 digits.';
    }

    return errors;
  }

  private restore(): Address[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Address[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private restoreSelected(): string | null {
    try {
      return localStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  }
}
