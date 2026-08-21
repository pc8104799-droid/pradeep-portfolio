import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ScrollService } from '@pc/core';
import { Icon } from '../icon/icon';

/** Floating return-to-top control with a progress ring drawn around it. */
@Component({
  selector: 'app-back-to-top',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <button
      type="button"
      class="fab"
      [class.is-shown]="scroll.deepScrolled()"
      [attr.tabindex]="scroll.deepScrolled() ? 0 : -1"
      (click)="scroll.scrollToTop()"
      aria-label="Back to top"
    >
      <svg class="ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle class="ring__track" cx="22" cy="22" r="20" />
        <circle
          class="ring__value"
          cx="22"
          cy="22"
          r="20"
          [style.stroke-dashoffset]="dashOffset()"
        />
      </svg>
      <app-icon name="arrowUp" [size]="18" />
    </button>
  `,
  styleUrl: './back-to-top.scss',
})
export class BackToTop {
  protected readonly scroll = inject(ScrollService);

  private static readonly CIRCUMFERENCE = 2 * Math.PI * 20;

  protected dashOffset(): number {
    return BackToTop.CIRCUMFERENCE * (1 - this.scroll.progress());
  }
}
