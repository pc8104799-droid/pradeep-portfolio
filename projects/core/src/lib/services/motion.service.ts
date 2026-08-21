import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * Central answer to "may I animate?". Every canvas loop, tilt and cursor effect
 * checks this so `prefers-reduced-motion` is honoured in one place, and it stays
 * live if the user flips the OS setting mid-visit.
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly query = window.matchMedia('(prefers-reduced-motion: reduce)');

  private readonly _reduced = signal(this.query.matches);
  readonly reduced = this._reduced.asReadonly();

  /** True on pointer-capable devices — gates cursor and tilt effects. */
  readonly finePointer = signal(window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  constructor() {
    const onChange = (event: MediaQueryListEvent) => this._reduced.set(event.matches);
    this.query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => this.query.removeEventListener('change', onChange));
  }

  get allowsMotion(): boolean {
    return !this._reduced();
  }
}
