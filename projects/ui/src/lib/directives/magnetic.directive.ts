import { Directive, ElementRef, inject, input } from '@angular/core';
import { MotionService } from '@pc/core';

const SPRING_BACK = 'transform 420ms cubic-bezier(.34, 1.56, .64, 1)';
const TRACKING = 'transform 90ms linear';

/**
 * Pulls an element a few pixels toward the cursor while hovered, then springs
 * back. Used on the hero call-to-actions and social buttons.
 *
 * Styles are written straight to the element rather than through host bindings —
 * these updates happen inside an animation frame and must not wait on a change
 * detection pass.
 */
@Directive({
  selector: '[appMagnetic]',
  host: {
    '(pointermove)': 'onMove($event)',
    '(pointerleave)': 'reset()',
  },
})
export class MagneticDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly motion = inject(MotionService);

  /** Travel in pixels at the edge of the element. */
  readonly strength = input(12, { alias: 'appMagnetic' });

  private frame = 0;

  protected onMove(event: PointerEvent): void {
    if (!this.motion.allowsMotion || !this.motion.finePointer()) {
      return;
    }

    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const el = this.host.nativeElement;
      const rect = el.getBoundingClientRect();
      const strength = this.strength();
      const dx = ((event.clientX - rect.left) / rect.width - 0.5) * 2 * strength;
      const dy = ((event.clientY - rect.top) / rect.height - 0.5) * 2 * strength;

      // While tracking the pointer the element should feel welded to it, so the
      // spring is only re-armed once the pointer leaves.
      el.style.transition = TRACKING;
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    });
  }

  protected reset(): void {
    cancelAnimationFrame(this.frame);
    const el = this.host.nativeElement;
    el.style.transition = SPRING_BACK;
    el.style.transform = 'translate3d(0, 0, 0)';
  }
}
