import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  type OnInit,
  signal,
} from '@angular/core';
import {
  ContentService,
  EditorDraft,
  type PortfolioContent,
  type SectionDef,
} from '@pc/core';
import { Field, Icon } from '@pc/ui';

/**
 * Edits a single object branch of the content — the profile, the education
 * entry, or (when the section's key is empty) plain lists on the content root.
 */
@Component({
  selector: 'app-object-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Field, Icon],
  templateUrl: './object-editor.html',
  styleUrl: './editor.scss',
})
export class ObjectEditor implements OnInit {
  private readonly content = inject(ContentService);

  /** Which object branch to edit — supplied by the dashboard page. */
  readonly section = input.required<SectionDef>();

  protected draft!: EditorDraft;
  protected readonly saved = signal(false);

  ngOnInit(): void {
    this.draft = new EditorDraft(this.section().fields);
    this.draft.load(this.currentFor(this.section()));
  }

  protected save(): void {
    this.draft.markTouched();

    if (!this.draft.valid()) {
      return;
    }

    const next = this.draft.build<Record<string, unknown>>();

    if (this.section().key === '') {
      // Root section: each field is itself a top-level content branch.
      this.content.patchMany(next as Partial<PortfolioContent>);
    } else {
      // The schema guarantees this section's key points at an object branch;
      // the cast is the seam between the generic editor and the typed store.
      this.content.patch(
        this.section().key as 'profile',
        next as unknown as PortfolioContent['profile'],
      );
    }

    this.draft.load(this.currentFor(this.section()));
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2400);
  }

  protected revert(): void {
    this.draft.load(this.currentFor(this.section()));
  }

  /** The object a section edits, straight from the store. */
  private currentFor(section: SectionDef): unknown {
    const key = section.key;
    return key === '' ? this.content.content() : this.content.content()[key];
  }
}
