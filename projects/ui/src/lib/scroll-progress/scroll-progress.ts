import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ScrollService } from '@pc/core';

/** Thin gradient rail across the top of the viewport showing read progress. */
@Component({
  selector: 'app-scroll-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rail"
      role="progressbar"
      aria-label="Page scroll progress"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="percent()"
      [style.transform]="'scaleX(' + scroll.progress() + ')'"
    ></div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0 0 auto;
      z-index: 1100;
      height: 3px;
      pointer-events: none;
    }

    .rail {
      height: 100%;
      transform-origin: 0 50%;
      background: var(--grad-brand);
      box-shadow: 0 0 18px rgb(0 212 255 / 60%);
      transition: transform 90ms linear;
    }
  `,
})
export class ScrollProgress {
  protected readonly scroll = inject(ScrollService);

  protected percent(): number {
    return Math.round(this.scroll.progress() * 100);
  }
}
