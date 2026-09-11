import { computed, effect, Injectable, signal } from '@angular/core';

export type ThemeId = 'light' | 'dark' | 'blue' | 'green' | 'purple' | 'contrast';

export interface ThemeOption {
  readonly id: ThemeId;
  readonly name: string;
  readonly hint: string;
  /** Two swatches for the theme picker: surface, then accent. */
  readonly swatch: readonly [string, string];
  readonly dark: boolean;
}

/**
 * The six themes, in the order the picker lists them.
 *
 * The swatches are literal hex values only because they are previews of a
 * theme that is not currently applied — every other colour in the app comes
 * from the CSS custom properties these ids select.
 */
export const THEMES: readonly ThemeOption[] = [
  { id: 'light', name: 'Light', hint: 'Clean clinical white', swatch: ['#ffffff', '#0b7285'], dark: false },
  { id: 'dark', name: 'Dark', hint: 'Easy on night shifts', swatch: ['#111a22', '#3bc9db'], dark: true },
  { id: 'blue', name: 'Blue Healthcare', hint: 'Classic hospital blue', swatch: ['#f2f7fd', '#1864ab'], dark: false },
  { id: 'green', name: 'Green Healthcare', hint: 'Calm and reassuring', swatch: ['#f3faf5', '#0f7a45'], dark: false },
  { id: 'purple', name: 'Purple', hint: 'Modern and warm', swatch: ['#f8f5fe', '#6741d9'], dark: false },
  { id: 'contrast', name: 'High Contrast', hint: 'Maximum legibility', swatch: ['#ffffff', '#000000'], dark: false },
];

const STORAGE_KEY = 'medicare360-theme';
const DENSITY_KEY = 'medicare360-density';

export type Density = 'comfortable' | 'compact';

/**
 * Owns the active theme and layout density.
 *
 * Nothing is applied by class name: the theme is written to
 * `<html data-theme>` and every token in styles.scss is keyed off it, so a
 * component never needs to know which theme is running. Density is the same
 * idea applied to spacing, which is what makes the dense tables usable on a
 * reception desk without a second stylesheet.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<ThemeId>(readTheme());
  private readonly _density = signal<Density>(readDensity());

  readonly theme = this._theme.asReadonly();
  readonly density = this._density.asReadonly();
  readonly options = THEMES;

  readonly current = computed(() => THEMES.find((option) => option.id === this._theme()) ?? THEMES[0]);
  readonly isDark = computed(() => this.current().dark);

  constructor() {
    effect(() => {
      const theme = this._theme();
      const root = document.documentElement;

      root.dataset['theme'] = theme;
      root.dataset['density'] = this._density();

      // Keeps the mobile browser chrome in step with the page.
      root
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', THEMES.find((option) => option.id === theme)?.swatch[0] ?? '#ffffff');

      try {
        localStorage.setItem(STORAGE_KEY, theme);
        localStorage.setItem(DENSITY_KEY, this._density());
      } catch {
        // The choice still applies; it just will not survive a refresh.
      }
    });
  }

  set(theme: ThemeId): void {
    this._theme.set(theme);
  }

  setDensity(density: Density): void {
    this._density.set(density);
  }

  /** The header button: flips between the current light theme and dark. */
  toggle(): void {
    this._theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }
}

function readTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some((option) => option.id === stored)) return stored as ThemeId;
  } catch {
    // Fall through to the system preference.
  }

  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
}
