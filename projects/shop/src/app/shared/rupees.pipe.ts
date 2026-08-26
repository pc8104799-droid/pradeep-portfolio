import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Formats rupees the Indian way — ₹1,24,500 — with paise shown only when they
 * exist, so whole-rupee prices stay clean.
 */
@Pipe({ name: 'rupees' })
export class RupeesPipe implements PipeTransform {
  private static readonly whole = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  private static readonly paise = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  });

  transform(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }

    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded)
      ? RupeesPipe.whole.format(rounded)
      : RupeesPipe.paise.format(rounded);
  }
}
