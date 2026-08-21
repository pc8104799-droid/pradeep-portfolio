import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ContentService } from '@pc/core';
import { RevealDirective } from '@pc/ui';
import { TiltDirective } from '@pc/ui';
import { Icon } from '@pc/ui';
import { SectionHeading } from '@pc/ui';

const ALL = 'All';

@Component({
  selector: 'app-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, SectionHeading, RevealDirective, TiltDirective],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects {
  private readonly content = inject(ContentService);

  protected readonly projects = this.content.projects;
  protected get total() {
    return this.projects().length;
  }

  protected readonly activeFilter = signal(ALL);
  protected readonly expanded = signal<string | null>(null);

  /** Any technology used by more than one project earns a filter chip. */
  protected readonly filters = computed(() => {
    const counts = new Map<string, number>();

    for (const project of this.projects()) {
      for (const tech of project.stack) {
        counts.set(tech, (counts.get(tech) ?? 0) + 1);
      }
    }

    const shared = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tech]) => tech);

    return [ALL, ...shared];
  });

  protected readonly visible = computed(() => {
    const filter = this.activeFilter();
    const projects = this.projects();

    return filter === ALL
      ? projects
      : projects.filter((project) => project.stack.includes(filter));
  });

  protected setFilter(filter: string): void {
    this.activeFilter.set(filter);
  }

  /** Zero-pads the card's ordinal for the watermark. */
  protected pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  protected toggle(title: string): void {
    this.expanded.update((open) => (open === title ? null : title));
  }
}
