import { Directive, ElementRef, inject, input } from '@angular/core';
import { MotionService } from '@pc/core';

/**
 * 3D pointer tilt with a light source that follows the cursor.
 *
 * Writes four custom properties the host stylesheet consumes
 * (`--tilt-x`, `--tilt-y`, `--glare-x`, `--glare-y`) instead of setting
 * `transform` directly, so each card decides how strongly to react.
 */
@Directive({
  selector: '[appTilt]',
  host: {
    '(pointermove)': 'onMove($event)',
    '(pointerenter)': 'onEnter()',
    '(pointerleave)': 'onLeave()',
  },
})
export class TiltDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly motion = inject(MotionService);

  /** Maximum rotation in degrees on each axis. */
  readonly max = input(8, { alias: 'appTilt' });

  private frame = 0;

  protected onEnter(): void {
    if (this.enabled) {
      this.host.nativeElement.style.setProperty('--tilt-active', '1');
    }
  }

  protected onMove(event: PointerEvent): void {
    if (!this.enabled) {
      return;
    }

    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const el = this.host.nativeElement;
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const max = this.max();

      el.style.setProperty('--tilt-y', `${(px - 0.5) * 2 * max}deg`);
      el.style.setProperty('--tilt-x', `${(0.5 - py) * 2 * max}deg`);
      el.style.setProperty('--glare-x', `${px * 100}%`);
      el.style.setProperty('--glare-y', `${py * 100}%`);
    });
  }

  protected onLeave(): void {
    cancelAnimationFrame(this.frame);
    const el = this.host.nativeElement;
    el.style.setProperty('--tilt-active', '0');
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  }

  private get enabled(): boolean {
    return this.motion.allowsMotion && this.motion.finePointer();
  }
}
