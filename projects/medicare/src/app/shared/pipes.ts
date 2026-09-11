import { Pipe, type PipeTransform } from '@angular/core';

/**
 * The small formatting pipes the whole app shares.
 *
 * They live together because they are all one-liners over the same domain
 * conventions: rupees, `YYYY-MM-DD` dates, `HH:mm` times and the kebab-case
 * status strings the API uses.
 */

/** `1240` → `₹1,240`. Indian digit grouping, never a decimal on whole rupees. */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined, options?: { paise?: boolean }): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: options?.paise ? 2 : 0,
      maximumFractionDigits: options?.paise ? 2 : 0,
    }).format(value);
  }
}

/** `2026-09-11` → `Fri, 11 Sep 2026`. Accepts a date or an ISO timestamp. */
@Pipe({ name: 'day' })
export class DayPipe implements PipeTransform {
  transform(value: string | null | undefined, format: 'full' | 'short' | 'month' = 'full'): string {
    if (!value) return '—';

    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) return value;

    const options: Intl.DateTimeFormatOptions =
      format === 'short'
        ? { day: 'numeric', month: 'short' }
        : format === 'month'
          ? { month: 'long', year: 'numeric' }
          : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };

    return date.toLocaleDateString('en-IN', options);
  }
}

/** `14:30` → `2:30 pm`. Clock times in a hospital are read, not calculated. */
@Pipe({ name: 'clock' })
export class ClockPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';

    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours)) return value;

    const suffix = hours < 12 ? 'am' : 'pm';
    const display = hours % 12 === 0 ? 12 : hours % 12;

    return `${display}:${String(minutes ?? 0).padStart(2, '0')} ${suffix}`;
  }
}

/**
 * `2026-09-11T09:12:00Z` → `2 hours ago`, or `in 3 days`.
 *
 * Relative time is the right unit for a notification feed: nobody reads a
 * timestamp to work out that something happened a minute ago.
 */
@Pipe({ name: 'when' })
export class WhenPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';

    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return value;

    const seconds = Math.round((then - Date.now()) / 1000);
    const absolute = Math.abs(seconds);

    const format = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

    if (absolute < 45) return 'just now';
    if (absolute < 3600) return format.format(Math.round(seconds / 60), 'minute');
    if (absolute < 86_400) return format.format(Math.round(seconds / 3600), 'hour');
    if (absolute < 2_592_000) return format.format(Math.round(seconds / 86_400), 'day');
    if (absolute < 31_536_000) return format.format(Math.round(seconds / 2_592_000), 'month');

    return format.format(Math.round(seconds / 31_536_000), 'year');
  }
}

/** `in-consultation` → `In consultation`. For API enums shown as labels. */
@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';

    const words = value.replaceAll('-', ' ').replaceAll('_', ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}

/** `['Penicillin','Dust']` → `Penicillin, Dust`, with a fallback for empty. */
@Pipe({ name: 'listOr' })
export class ListOrPipe implements PipeTransform {
  transform(value: readonly string[] | null | undefined, fallback = 'None recorded'): string {
    return value && value.length ? value.join(', ') : fallback;
  }
}

/** First letters of a name, for the avatar circles. `Dr Anaya Mehta` → `AM`. */
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';

    const words = value
      .replace(/^Dr\.?\s+/i, '')
      .split(/\s+/)
      .filter(Boolean);

    return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  }
}

/** Every pipe above, for a component's `imports` array. */
export const MC_PIPES = [
  InrPipe,
  DayPipe,
  ClockPipe,
  WhenPipe,
  LabelPipe,
  ListOrPipe,
  InitialsPipe,
] as const;
