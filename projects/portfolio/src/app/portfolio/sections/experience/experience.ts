import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ContentService } from '@pc/core';
import { RevealDirective } from '@pc/ui';
import { ScrollService } from '@pc/core';
import { Icon } from '@pc/ui';
import { SectionHeading } from '@pc/ui';

@Component({
  selector: 'app-experience',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, SectionHeading, RevealDirective],
  templateUrl: './experience.html',
  styleUrl: './experience.scss',
})
export class Experience {
  private readonly scroll = inject(ScrollService);
  private readonly timelineRef = viewChild<ElementRef<HTMLElement>>('timeline');

  private readonly content = inject(ContentService);

  protected get roles() {
    return this.content.experiences();
  }

  /** 0 → 1 fill of the timeline rail, tied to how far the list has scrolled past. */
  protected readonly railFill = signal(0);

  constructor() {
    effect(() => {
      // Re-measure whenever the page scrolls.
      this.scroll.offset();

      const el = this.timelineRef()?.nativeElement;
      if (!el) {
        return;
      }

      const rect = el.getBoundingClientRect();
      const line = window.innerHeight * 0.55;
      const travelled = line - rect.top;
      this.railFill.set(Math.min(1, Math.max(0, travelled / rect.height)));
    });
  }
}
