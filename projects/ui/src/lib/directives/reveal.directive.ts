import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  numberAttribute,
  OnInit,
} from '@angular/core';

export type RevealVariant = 'up' | 'left' | 'right' | 'scale';

/**
 * Reveals an element the first time it scrolls into view.
 *
 * The directive only toggles a class — the actual transition is declared once in
 * styles.scss against `[data-reveal]`, so reveals stay consistent everywhere and
 * cost nothing at runtime beyond a single IntersectionObserver entry.
 */
@Directive({
  selector: '[appReveal]',
  host: {
    '[attr.data-reveal]': 'variant()',
    '[style.--reveal-delay.ms]': 'delay()',
  },
})
export class RevealDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** A bare `appReveal` attribute means the default upward reveal. */
  readonly variant = input<RevealVariant, RevealVariant | ''>('up', {
    alias: 'appReveal',
    transform: (value) => value || 'up',
  });
  /** Stagger in milliseconds — pass `$index * 80` inside a loop. */
  readonly delay = input(0, { alias: 'revealDelay', transform: numberAttribute });
  /** How much of the element must be visible before it fires. */
  readonly threshold = input(0.16, { alias: 'revealThreshold', transform: numberAttribute });

  ngOnInit(): void {
    const el = this.host.nativeElement;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-visible');
            observer.unobserve(el);
          }
        }
      },
      { threshold: this.threshold(), rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(el);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
