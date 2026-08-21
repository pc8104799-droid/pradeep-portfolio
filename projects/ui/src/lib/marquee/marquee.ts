import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Infinite horizontal ticker. The item list is rendered twice and the track is
 * translated by exactly -50%, so the seam is invisible and the loop never jumps.
 */
@Component({
  selector: 'app-marquee',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewport" [class.viewport--reverse]="reverse()">
      <ul class="track" [style.--marquee-duration.s]="duration()" aria-hidden="true">
        @for (item of doubled(); track $index) {
          <li class="item">
            <span class="dot"></span>
            {{ item }}
          </li>
        }
      </ul>
    </div>
    <p class="sr-only">Technologies: {{ items().join(', ') }}</p>
  `,
  styleUrl: './marquee.scss',
})
export class Marquee {
  readonly items = input.required<readonly string[]>();
  readonly duration = input(38);
  readonly reverse = input(false);

  protected readonly doubled = computed(() => [...this.items(), ...this.items()]);
}
