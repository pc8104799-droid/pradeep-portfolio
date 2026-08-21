import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Circle = readonly [cx: number, cy: number, r: number];

interface Glyph {
  readonly paths: readonly string[];
  readonly circles?: readonly Circle[];
  /** Filled rather than stroked (used by the solid brand marks). */
  readonly filled?: boolean;
}

export type IconName = keyof typeof GLYPHS;

/**
 * Every icon in the site, drawn on a 24x24 grid so stroke weight stays even.
 * Keeping them inline means no icon-font request and no external dependency.
 */
const GLYPHS = {
  mail: {
    paths: [
      'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
      'm3.6 7.4 8.4 5.9 8.4-5.9',
    ],
  },
  phone: {
    paths: [
      'M6.6 3h3l1.5 4-2 1.5a11 11 0 0 0 6.4 6.4L17 12.9l4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.6 5a2 2 0 0 1 2-2Z',
    ],
  },
  linkedin: {
    paths: [
      'M4.6 9h3v10.5h-3z',
      'M10.6 19.5V9h3v1.6a3.6 3.6 0 0 1 3.2-1.8c2.4 0 3.7 1.6 3.7 4.4v6.3h-3v-5.7c0-1.4-.6-2.3-1.8-2.3-1.3 0-2.1 1-2.1 2.4v5.6z',
    ],
    circles: [[6.1, 5.3, 1.7]],
  },
  whatsapp: {
    paths: [
      'M20.5 11.6a8.4 8.4 0 0 1-12.5 7.3L3.5 20.5l1.6-4.4A8.5 8.5 0 1 1 20.5 11.6Z',
      'M9.3 9.4c0 3 2.4 5.4 5.4 5.4',
    ],
  },
  github: {
    paths: [
      'M9.2 20.4c-3.8 1.1-3.8-2-5.2-2.6',
      'M14.8 21.5v-3.3c0-1 .1-1.4-.5-2 2.3-.3 4.4-1.2 4.4-4.9a3.9 3.9 0 0 0-1.1-2.7 3.6 3.6 0 0 0-.1-2.7s-1.1-.4-3.8 1.4a9.1 9.1 0 0 0-4.9 0C6.1 5.5 5 5.9 5 5.9a3.6 3.6 0 0 0-.1 2.7 3.9 3.9 0 0 0-1.1 2.7c0 3.7 2.1 4.6 4.4 4.9-.6.6-.6 1.2-.5 2v3.3',
    ],
  },
  location: {
    paths: ['M12 21.2s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z'],
    circles: [[12, 10.1, 2.5]],
  },
  layers: {
    paths: ['m12 3 9 4.8-9 4.8-9-4.8 9-4.8Z', 'm3 12.2 9 4.8 9-4.8', 'm3 16.6 9 4.8 9-4.8'],
  },
  flow: {
    paths: ['M6 7.2v9.6', 'M8 5.4h3.6A4.4 4.4 0 0 1 16 9.8v.6', 'M8 18.6h3.6A4.4 4.4 0 0 0 16 14.2v-.6'],
    circles: [
      [6, 5.2, 2],
      [6, 18.8, 2],
      [18, 12, 2],
    ],
  },
  gauge: {
    paths: ['m12 13.8 4.6-4.6', 'M3.8 17a8.6 8.6 0 1 1 16.4 0'],
    circles: [[12, 13.8, 1.5]],
  },
  sparkle: {
    paths: [
      'M11 3.2 12.7 8.4 18 10.1l-5.3 1.7L11 17l-1.7-5.2L4 10.1l5.3-1.7L11 3.2Z',
      'M18.2 15.6l.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8Z',
    ],
  },
  code: {
    paths: ['m9.4 7.8-5.6 4.2 5.6 4.2', 'm14.6 7.8 5.6 4.2-5.6 4.2'],
  },
  palette: {
    paths: [
      'M12 3a9 9 0 0 0 0 18c1.4 0 2.1-.9 2.1-1.9 0-.9-.6-1.6-.6-2.4 0-.9.7-1.6 1.6-1.6h1.7A4.2 4.2 0 0 0 21 11.1C21 6.6 16.9 3 12 3Z',
    ],
    circles: [
      [7.4, 11.2, 1.1],
      [10.4, 7.6, 1.1],
      [15, 7.9, 1.1],
    ],
  },
  tools: {
    paths: [
      'M14.6 6.6a3.5 3.5 0 0 1 4.9 4.9l-1.4-1.4-2.1 2.1-3.5-3.5 2.1-2.1Z',
      'm12.5 8.7-7.1 7.1a2.5 2.5 0 0 0 3.5 3.5l7.1-7.1',
    ],
  },
  briefcase: {
    paths: [
      'M4 8.4h16a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.4a1 1 0 0 1 1-1Z',
      'M9 8.4V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2.4',
      'M3 13h18',
    ],
  },
  graduation: {
    paths: ['m12 3.8 9.4 4.5L12 12.8 2.6 8.3 12 3.8Z', 'M6.2 10.4V16c0 1.6 2.6 3 5.8 3s5.8-1.4 5.8-3v-5.6'],
  },
  calendar: {
    paths: [
      'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
      'M4 10.4h16',
      'M8.4 4v4',
      'M15.6 4v4',
    ],
  },
  arrowUpRight: {
    paths: ['M7 17 17 7', 'M9.4 7H17v7.6'],
  },
  arrowDown: {
    paths: ['M12 4.4v15.2', 'm6 13.6 6 6 6-6'],
  },
  arrowUp: {
    paths: ['M12 19.6V4.4', 'm6 10.4 6-6 6 6'],
  },
  arrowRight: {
    paths: ['M4.5 12h15', 'm13.5 6 6 6-6 6'],
  },
  external: {
    paths: ['M14 4h6v6', 'M20 4 10.4 13.6', 'M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10'],
  },
  download: {
    paths: ['M12 3.6v11', 'm7.5 10.4 4.5 4.5 4.5-4.5', 'M4.6 19.6h14.8'],
  },
  sun: {
    paths: [
      'M12 2.4v2.2',
      'M12 19.4v2.2',
      'm4.7 4.7 1.6 1.6',
      'm17.7 17.7 1.6 1.6',
      'M2.4 12h2.2',
      'M19.4 12h2.2',
      'm4.7 19.3 1.6-1.6',
      'm17.7 6.3 1.6-1.6',
    ],
    circles: [[12, 12, 4]],
  },
  moon: {
    paths: ['M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8Z'],
  },
  menu: {
    paths: ['M4 7.5h16', 'M4 12h16', 'M4 16.5h11'],
  },
  close: {
    paths: ['m6.5 6.5 11 11', 'm17.5 6.5-11 11'],
  },
  copy: {
    paths: [
      'M9.6 9.6h8.9a1.5 1.5 0 0 1 1.5 1.5v8.9a1.5 1.5 0 0 1-1.5 1.5H9.6a1.5 1.5 0 0 1-1.5-1.5v-8.9a1.5 1.5 0 0 1 1.5-1.5Z',
      'M5.5 15.9A1.5 1.5 0 0 1 4 14.4V5.5A1.5 1.5 0 0 1 5.5 4h8.9a1.5 1.5 0 0 1 1.5 1.5V7',
    ],
  },
  check: {
    paths: ['m5 12.6 4.6 4.6L19 7.8'],
  },
  send: {
    paths: ['M21 3 10.6 13.4', 'M21 3l-6.5 18-4-8.6L2 8.4 21 3Z'],
  },
  star: {
    paths: ['m12 3.8 2.5 5.3 5.7.7-4.2 4 1.1 5.7L12 16.7l-5.1 2.8L8 13.8l-4.2-4 5.7-.7L12 3.8Z'],
  },
  lock: {
    paths: [
      'M6.4 11h11.2a1 1 0 0 1 1 1v7.1a1 1 0 0 1-1 1H6.4a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1Z',
      'M8.6 11V8.2a3.4 3.4 0 0 1 6.8 0V11',
    ],
  },
  zap: {
    paths: ['M13.2 3 5.4 13.6h5.1L9.2 21 17 10.4h-5.1L13.2 3Z'],
  },
  quote: {
    paths: [
      'M9.5 6.5C6.9 7.6 5 10.2 5 13.4V17a1.5 1.5 0 0 0 1.5 1.5H9A1.5 1.5 0 0 0 10.5 17v-2.5A1.5 1.5 0 0 0 9 13H7.5',
      'M18 6.5c-2.6 1.1-4.5 3.7-4.5 6.9V17a1.5 1.5 0 0 0 1.5 1.5h2.5A1.5 1.5 0 0 0 19 17v-2.5A1.5 1.5 0 0 0 17.5 13H16',
    ],
  },
} as const satisfies Record<string, Glyph>;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="weight()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (d of glyph().paths; track d) {
        <path [attr.d]="d" />
      }
      @for (c of glyph().circles ?? []; track c[0] + '-' + c[1]) {
        <circle [attr.cx]="c[0]" [attr.cy]="c[1]" [attr.r]="c[2]" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      line-height: 0;
    }
  `,
})
export class Icon {
  /**
   * Accepts any string: icon names come from editable content, so an unknown
   * name must render a neutral mark rather than fail to compile or throw.
   */
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly weight = input(1.7);

  protected readonly glyph = computed<Glyph>(
    () => GLYPHS[this.name() as IconName] ?? GLYPHS.sparkle,
  );
}

/** Every available icon name — used by the admin icon picker. */
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];
