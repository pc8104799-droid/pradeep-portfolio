import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ContentService } from '@pc/core';
import { RevealDirective } from '@pc/ui';
import { Icon } from '@pc/ui';
import { SectionHeading } from '@pc/ui';

@Component({
  selector: 'app-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, SectionHeading, RevealDirective],
  templateUrl: './skills.html',
  styleUrl: './skills.scss',
})
export class Skills {
  private readonly content = inject(ContentService);

  protected get groups() {
    return this.content.skillGroups();
  }

  protected get coreStack() {
    return this.content.coreStack();
  }

  protected readonly totalSkills = computed(() =>
    this.content.skillGroups().reduce((sum, group) => sum + group.skills.length, 0),
  );

  /** Zero-pads the card's ordinal. */
  protected pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
