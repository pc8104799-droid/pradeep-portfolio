import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { FieldDef } from '@pc/core';
import { Icon, ICON_NAMES } from '../icon/icon';

/**
 * Renders one editable field from its schema definition. Every editor in the
 * dashboard is built out of these, so a new field type is added once here
 * rather than in each editor.
 */
@Component({
  selector: 'pc-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './field.html',
  styleUrl: './field.scss',
  host: {
    '[class.is-wide]': 'field().wide',
    '[class.is-invalid]': 'invalid()',
  },
})
export class Field {
  readonly field = input.required<FieldDef>();
  readonly value = input<unknown>();
  /** Set once the user has interacted, so errors do not shout on a fresh form. */
  readonly touched = input(false);

  readonly changed = output<unknown>();

  protected readonly iconNames = ICON_NAMES;

  /** Multi-line text for `list` fields: one entry per line. */
  protected readonly asText = computed(() => {
    const value = this.value();

    if (this.field().type === 'list') {
      return Array.isArray(value) ? value.join('\n') : '';
    }

    return value == null ? '' : String(value);
  });

  protected readonly asNumber = computed(() => Number(this.value() ?? 0));
  protected readonly asBoolean = computed(() => Boolean(this.value()));

  protected readonly empty = computed(() => {
    const value = this.value();
    return Array.isArray(value) ? value.length === 0 : value === '' || value == null;
  });

  protected readonly invalid = computed(
    () => Boolean(this.field().required) && this.empty() && this.touched(),
  );

  protected onText(event: Event): void {
    const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value;

    if (this.field().type === 'list') {
      // Blank lines are dropped so a stray newline never becomes an empty tag.
      this.changed.emit(
        raw
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      );
      return;
    }

    this.changed.emit(raw);
  }

  protected onNumber(event: Event): void {
    const raw = (event.target as HTMLInputElement).valueAsNumber;
    this.changed.emit(Number.isFinite(raw) ? raw : 0);
  }

  protected onBoolean(event: Event): void {
    this.changed.emit((event.target as HTMLInputElement).checked);
  }

  protected onSelect(event: Event): void {
    this.changed.emit((event.target as HTMLSelectElement).value);
  }

  /** Rows for a list textarea — grows with content, within reason. */
  protected readonly rows = computed(() => {
    const lines = this.asText().split('\n').length;
    return Math.min(14, Math.max(this.field().type === 'list' ? 4 : 3, lines + 1));
  });
}
