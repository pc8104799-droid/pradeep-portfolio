import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { MotionService } from '@pc/core';

/**
 * Two-part cursor: a hard dot that tracks the pointer exactly, and a ring that
 * lags behind with a spring. The ring swells over anything interactive.
 *
 * Rendered only on fine-pointer devices, and positions are written straight to
 * the elements inside an animation frame — never through bindings.
 */
@Component({
  selector: 'app-cursor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #ring class="ring" aria-hidden="true"></div>
    <div #dot class="dot" aria-hidden="true"></div>
  `,
  styleUrl: './cursor.scss',
})
export class Cursor {
  private readonly ringRef = viewChild.required<ElementRef<HTMLElement>>('ring');
  private readonly dotRef = viewChild.required<ElementRef<HTMLElement>>('dot');
  private readonly motion = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);

  private target = { x: -100, y: -100 };
  private ringPos = { x: -100, y: -100 };
  private frame = 0;

  constructor() {
    afterNextRender(() => {
      if (this.motion.finePointer()) {
        this.start();
      }
    });
  }

  private start(): void {
    const ring = this.ringRef().nativeElement;
    const dot = this.dotRef().nativeElement;
    const host = ring.parentElement!;

    const onMove = (event: PointerEvent) => {
      this.target = { x: event.clientX, y: event.clientY };
      dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;

      const interactive = (event.target as Element | null)?.closest(
        'a, button, input, textarea, [data-cursor="grow"]',
      );
      host.classList.toggle('is-hot', Boolean(interactive));
    };

    const onDown = () => host.classList.add('is-down');
    const onUp = () => host.classList.remove('is-down');
    const onEnter = () => host.classList.add('is-live');
    const onLeave = () => host.classList.remove('is-live');

    // Ring easing: move 18% of the remaining distance per frame.
    const loop = () => {
      this.ringPos.x += (this.target.x - this.ringPos.x) * 0.18;
      this.ringPos.y += (this.target.y - this.ringPos.y) * 0.18;
      ring.style.transform =
        `translate3d(${this.ringPos.x}px, ${this.ringPos.y}px, 0) translate(-50%, -50%)`;
      this.frame = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('pointerenter', onEnter);
    document.addEventListener('pointerleave', onLeave);
    host.classList.add('is-live');
    this.frame = requestAnimationFrame(loop);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerenter', onEnter);
      document.removeEventListener('pointerleave', onLeave);
    });
  }
}
