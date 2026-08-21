import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ContentService } from '@pc/core';
import { Icon } from '@pc/ui';

/**
 * Where edits leave the browser. Everything the admin area changes lives in
 * localStorage; this page exports it as the `content.json` to commit, takes a
 * file back in, and can drop local edits entirely.
 */
@Component({
  selector: 'app-data-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './data-page.html',
  styleUrl: './data-page.scss',
})
export class DataPage {
  protected readonly content = inject(ContentService);

  protected readonly copied = signal(false);
  protected readonly error = signal('');
  protected readonly imported = signal(false);
  protected readonly confirmingReset = signal(false);

  protected readonly json = computed(() => this.content.serialise());
  protected readonly sizeKb = computed(() => (this.json().length / 1024).toFixed(1));

  protected readonly counts = computed(() => {
    const c = this.content.content();
    return [
      { label: 'Contact links', value: c.socials.length },
      { label: 'Stats', value: c.stats.length },
      { label: 'Capabilities', value: c.services.length },
      { label: 'Core stack', value: c.coreStack.length },
      { label: 'Skill groups', value: c.skillGroups.length },
      { label: 'Roles', value: c.experiences.length },
      { label: 'Projects', value: c.projects.length },
      { label: 'Marquee items', value: c.marquee.length },
    ];
  });

  protected download(): void {
    this.content.download();
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.json());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2200);
    } catch {
      this.error.set('Clipboard access was blocked — use Download instead.');
    }
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      this.content.import(await file.text());
      this.imported.set(true);
      this.error.set('');
      setTimeout(() => this.imported.set(false), 2800);
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : 'That file could not be read.');
    } finally {
      // Allow re-selecting the same file after a fix.
      input.value = '';
    }
  }

  protected async reset(): Promise<void> {
    await this.content.reset();
    this.confirmingReset.set(false);
    this.error.set('');
  }
}
