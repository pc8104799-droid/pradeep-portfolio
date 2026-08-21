import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RevealDirective } from '../directives/reveal.directive';

/**
 * Shared section header: index chip, eyebrow label, gradient-accented title and
 * an optional lede. Keeps every section's rhythm identical.
 */
@Component({
  selector: 'app-section-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective],
  template: `
    <header class="head" [class.head--center]="centered()">
      <div class="head__meta" appReveal>
        <span class="head__index mono">{{ index() }}</span>
        <span class="eyebrow">{{ eyebrow() }}</span>
      </div>

      <h2 class="head__title" appReveal revealDelay="90">
        {{ title() }}
        @if (accent()) {
          <span class="grad-text">{{ accent() }}</span>
        }
      </h2>

      @if (lede()) {
        <p class="lede head__lede" appReveal revealDelay="170">{{ lede() }}</p>
      }
    </header>
  `,
  styleUrl: './section-heading.scss',
})
export class SectionHeading {
  readonly index = input('');
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  /** Trailing words rendered in the brand gradient. */
  readonly accent = input('');
  readonly lede = input('');
  readonly centered = input(false);
}
