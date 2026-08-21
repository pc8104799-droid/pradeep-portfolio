import { DestroyRef, Directive, ElementRef, inject, input, OnInit } from '@angular/core';
import { MotionService } from '@pc/core';

/** Eases toward the target so the last digits settle rather than snap. */
const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Counts from zero to `appCountUp` the first time the element is seen.
 * Writes textContent directly — no template binding, no change detection churn
 * on every one of the ~100 frames.
 */
@Directive({
  selector: '[appCountUp]',
})
export class CountUpDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly motion = inject(MotionService);

  readonly target = input.required<number>({ alias: 'appCountUp' });
  readonly duration = input(1600, { alias: 'countUpDuration' });
  readonly suffix = input('', { alias: 'countUpSuffix' });

  private frame = 0;

  ngOnInit(): void {
    const el = this.host.nativeElement;
    const target = this.target();

    if (!this.motion.allowsMotion) {
      el.textContent = `${target}${this.suffix()}`;
      return;
    }

    el.textContent = `0${this.suffix()}`;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.unobserve(el);
            this.run(el, target);
          }
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(el);

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      cancelAnimationFrame(this.frame);
    });
  }

  private run(el: HTMLElement, target: number): void {
    const duration = this.duration();
    const suffix = this.suffix();
    let started: number | null = null;

    const step = (now: number) => {
      started ??= now;
      const progress = Math.min(1, (now - started) / duration);
      const value = Math.round(easeOutExpo(progress) * target);

      el.textContent = `${value}${suffix}`;

      if (progress < 1) {
        this.frame = requestAnimationFrame(step);
      }
    };

    this.frame = requestAnimationFrame(step);
  }
}
