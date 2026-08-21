import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  signal,
} from '@angular/core';
import {
  ContentService,
  EditorDraft,
  getPath,
  type ContentListKey,
  type SectionDef,
} from '@pc/core';
import { Field, Icon } from '@pc/ui';

type Row = Record<string, unknown>;

/** Sentinel for "the form is open on a new, not-yet-added row". */
const NEW_ROW = -1;

/**
 * Full CRUD for one array branch of the content: list on the left, form on the
 * right, plus reorder and delete. Entirely schema-driven, so every collection
 * gets the same behaviour.
 */
@Component({
  selector: 'app-collection-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Field, Icon],
  templateUrl: './collection-editor.html',
  styleUrl: './editor.scss',
})
export class CollectionEditor implements OnInit {
  private readonly content = inject(ContentService);

  /** Which collection to edit — supplied by the dashboard page. */
  readonly section = input.required<SectionDef>();

  protected draft!: EditorDraft;

  /** Index being edited, NEW_ROW while adding, or null when nothing is open. */
  protected readonly editing = signal<number | null>(null);
  protected readonly confirmingDelete = signal<number | null>(null);

  protected readonly rows = computed(
    () => this.content.content()[this.section().key as ContentListKey] as unknown as Row[],
  );

  protected readonly isNew = computed(() => this.editing() === NEW_ROW);

  ngOnInit(): void {
    this.draft = new EditorDraft(this.section().fields);
  }

  protected label(row: Row): string {
    const key = this.section().titleKey;
    const value = key ? getPath(row, key) : '';
    return value ? String(value) : 'Untitled';
  }

  protected sublabel(row: Row): string {
    const key = this.section().subtitleKey;
    const value = key ? getPath(row, key) : '';
    return value ? String(value) : '';
  }

  protected startAdd(): void {
    this.draft.load(structuredClone(this.section().blank ?? {}));
    this.editing.set(NEW_ROW);
    this.confirmingDelete.set(null);
  }

  protected startEdit(index: number): void {
    this.draft.load(this.rows()[index]);
    this.editing.set(index);
    this.confirmingDelete.set(null);
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  protected save(): void {
    this.draft.markTouched();

    if (!this.draft.valid()) {
      return;
    }

    const key = this.section().key as ContentListKey;
    const item = this.draft.build<Row>();
    const index = this.editing();

    if (index === NEW_ROW) {
      this.content.add(key, item as never);
      // Keep the form open on the row that was just created.
      this.editing.set(this.rows().length - 1);
      this.draft.load(this.rows()[this.rows().length - 1]);
      return;
    }

    if (index !== null) {
      this.content.update(key, index, item as never);
      this.draft.load(this.rows()[index]);
    }
  }

  protected move(index: number, delta: number): void {
    this.content.move(this.section().key as ContentListKey, index, delta);

    // Follow the row that moved so the open form still points at it.
    const open = this.editing();
    if (open === index) {
      this.editing.set(index + delta);
    } else if (open === index + delta) {
      this.editing.set(index);
    }
  }

  protected askDelete(index: number): void {
    this.confirmingDelete.set(index);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  protected confirmDelete(index: number): void {
    this.content.remove(this.section().key as ContentListKey, index);
    this.confirmingDelete.set(null);

    const open = this.editing();
    if (open === index) {
      this.editing.set(null);
    } else if (open !== null && open > index) {
      this.editing.set(open - 1);
    }
  }
}
