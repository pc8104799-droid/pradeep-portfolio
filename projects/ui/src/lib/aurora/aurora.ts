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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const LINK_DISTANCE = 130;
const PARTICLE_DENSITY = 14000; // one particle per N square pixels

/**
 * Fixed backdrop for the whole page: three drifting gradient orbs, a constellation
 * canvas that links nearby particles, and a grain overlay to kill banding.
 *
 * The canvas loop writes only to the canvas, never to component state, so it
 * never triggers change detection.
 */
@Component({
  selector: 'app-aurora',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="orb orb--violet"></div>
    <div class="orb orb--cyan"></div>
    <div class="orb orb--magenta"></div>
    <canvas #canvas class="constellation" aria-hidden="true"></canvas>
    <div class="grid-veil"></div>
    <div class="grain"></div>
  `,
  styleUrl: './aurora.scss',
})
export class Aurora {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly motion = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);

  private particles: Particle[] = [];
  private frame = 0;
  private pointer = { x: -999, y: -999 };

  constructor() {
    afterNextRender(() => this.start());
  }

  private start(): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.seed(window.innerWidth, window.innerHeight);
    };

    const onPointerMove = (event: PointerEvent) => {
      this.pointer = { x: event.clientX, y: event.clientY };
    };

    const onPointerLeave = () => {
      this.pointer = { x: -999, y: -999 };
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);

    // Reduced motion still gets the constellation — just painted once, static.
    if (this.motion.allowsMotion) {
      const loop = () => {
        this.step(ctx, window.innerWidth, window.innerHeight);
        this.frame = requestAnimationFrame(loop);
      };
      this.frame = requestAnimationFrame(loop);
    } else {
      this.step(ctx, window.innerWidth, window.innerHeight, false);
    }

    const onVisibility = () => {
      if (!this.motion.allowsMotion) {
        return;
      }

      cancelAnimationFrame(this.frame);
      if (!document.hidden) {
        const loop = () => {
          this.step(ctx, window.innerWidth, window.innerHeight);
          this.frame = requestAnimationFrame(loop);
        };
        this.frame = requestAnimationFrame(loop);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  private seed(width: number, height: number): void {
    const count = Math.min(90, Math.round((width * height) / PARTICLE_DENSITY));

    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.5 + 0.6,
    }));
  }

  private step(ctx: CanvasRenderingContext2D, width: number, height: number, advance = true): void {
    ctx.clearRect(0, 0, width, height);

    for (const p of this.particles) {
      if (advance) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) {
          p.vx *= -1;
        }
        if (p.y < 0 || p.y > height) {
          p.vy *= -1;
        }
      }

      // Particles brighten as the cursor approaches them.
      const dx = p.x - this.pointer.x;
      const dy = p.y - this.pointer.y;
      const near = Math.max(0, 1 - Math.hypot(dx, dy) / 220);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + near * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160, 180, 255, ${0.28 + near * 0.5})`;
      ctx.fill();
    }

    ctx.lineWidth = 0.6;

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);

        if (dist < LINK_DISTANCE) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(124, 92, 255, ${(1 - dist / LINK_DISTANCE) * 0.22})`;
          ctx.stroke();
        }
      }
    }
  }
}
