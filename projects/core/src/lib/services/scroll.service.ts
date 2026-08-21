import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ContentService } from './content.service';

/**
 * Single rAF-throttled scroll listener that feeds every scroll-reactive piece of
 * UI: the progress rail, the nav shrink state, the active nav link and the
 * back-to-top button. One listener beats a dozen.
 */
@Injectable({ providedIn: 'root' })
export class ScrollService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly content = inject(ContentService);

  /** 0 → 1 through the document. */
  readonly progress = signal(0);
  /** True once the user has left the very top of the page. */
  readonly scrolled = signal(false);
  /** True past roughly one viewport — used to reveal the back-to-top control. */
  readonly deepScrolled = signal(false);
  /** Id of the section currently occupying the reading area. */
  readonly activeSection = signal<string>(this.content.nav()[0].id);
  /** Raw scrollY, exposed for parallax. */
  readonly offset = signal(0);

  private ticking = false;

  constructor() {
    const onScroll = () => {
      if (this.ticking) {
        return;
      }

      this.ticking = true;
      requestAnimationFrame(() => {
        this.measure();
        this.ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    this.measure();

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    });
  }

  scrollTo(id: string): void {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const navHeight = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-h'),
    ) || 76;
    const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 12;

    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  }

  scrollToTop(): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }

  private measure(): void {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    this.offset.set(y);
    this.progress.set(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0);
    this.scrolled.set(y > 24);
    this.deepScrolled.set(y > window.innerHeight * 0.75);

    // The section whose top has passed the reading line (a third down the
    // viewport) wins; near the bottom the last section always wins so the final
    // nav item cannot be stranded.
    const line = window.innerHeight / 3;
    const navItems = this.content.nav();
    let active = navItems[0].id;

    for (const item of navItems) {
      const el = document.getElementById(item.id);
      if (el && el.getBoundingClientRect().top <= line) {
        active = item.id;
      }
    }

    if (max > 0 && max - y < 80) {
      active = navItems[navItems.length - 1].id;
    }

    this.activeSection.set(active);
  }
}
