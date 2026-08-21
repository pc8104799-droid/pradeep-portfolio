import { TestBed } from '@angular/core/testing';
import { Home } from './home';

/**
 * Layout regression tests.
 *
 * Every responsive breakpoint in the page sections is a `@container` query
 * against the section box, not a viewport media query — so mounting the page in
 * a fixed-width wrapper reproduces the real layout at that width, and these
 * assertions genuinely exercise the wide and narrow designs.
 */
describe('page layout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Home] }).compileComponents();
  });

  const clamp = (min: number, preferred: number, max: number) =>
    Math.min(Math.max(min, preferred), max);

  /**
   * Mounts the page at a given width. Viewport-relative units cannot follow a
   * wrapper, so the gutter and display type are pinned to the values the real
   * clamps would produce at this width.
   */
  function mountAt(width: number) {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      `width:${width}px`,
      `--gutter:${clamp(18.4, width * 0.035, 64)}px`,
      `--h1-size:${clamp(41.6, width * 0.074, 96)}px`,
      `--h2-size:${clamp(32, width * 0.046, 59.2)}px`,
    ].join(';');
    document.body.appendChild(wrap);

    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    wrap.appendChild(fixture.nativeElement);
    fixture.detectChanges();

    // Reveal animations start elements offset by up to 38px; IntersectionObserver
    // never fires here, so settle them into the state a visitor actually sees.
    wrap.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));

    return {
      wrap,
      one: (sel: string) => wrap.querySelector(sel) as HTMLElement,
      all: (sel: string) => Array.from(wrap.querySelectorAll(sel)) as HTMLElement[],
      trackCount: (sel: string) =>
        getComputedStyle(wrap.querySelector(sel) as HTMLElement)
          .gridTemplateColumns.split(' ')
          .filter(Boolean).length,
      destroy: () => wrap.remove(),
    };
  }

  it('never overflows its width, at any size', () => {
    for (const width of [360, 420, 900, 1440, 1920, 2560]) {
      const page = mountAt(width);

      // The marquee track is deliberately wider than the viewport and clipped
      // by its own overflow: hidden, so it is excluded.
      const spilling = page
        .all('*')
        .filter((el) => el.getBoundingClientRect().right > width + 1)
        .filter((el) => !el.closest('app-marquee'));

      expect(
        spilling.map(
          (el) =>
            `${el.tagName}.${String(el.className).split(' ')[0]}` +
            `@${Math.round(el.getBoundingClientRect().right)}px`,
        ),
      )
        .withContext(`elements spilling past ${width}px`)
        .toEqual([]);

      page.destroy();
    }
  });

  it('lays the six skill groups out in rows that always fill', () => {
    for (const [width, expected] of [[420, 1], [900, 2], [1440, 3], [1920, 3]] as const) {
      const page = mountAt(width);
      expect(page.trackCount('app-skills .grid'))
        .withContext(`skills columns at ${width}px`)
        .toBe(expected);
      page.destroy();
    }
  });

  it('splits the timeline card into two columns only when there is room', () => {
    for (const [width, sideBySide] of [[900, false], [1920, true]] as const) {
      const page = mountAt(width);
      const points = page.one('.entry__points');
      const keyproj = page.one('.keyproj');

      expect(Math.abs(points.offsetTop - keyproj.offsetTop) < 40)
        .withContext(`timeline split at ${width}px`)
        .toBe(sideBySide);

      page.destroy();
    }
  });

  it('spreads the section heading into title + lede columns when wide', () => {
    for (const [width, spread] of [[900, false], [1440, true]] as const) {
      const page = mountAt(width);
      const title = page.one('app-skills .head__title');
      const lede = page.one('app-skills .head__lede');

      expect(lede.offsetLeft > title.offsetLeft + 100)
        .withContext(`heading spread at ${width}px`)
        .toBe(spread);

      page.destroy();
    }
  });

  it('gives the lead project a double-width card with its highlights open', () => {
    const page = mountAt(1920);
    const featured = page.one('.proj.is-featured');
    const plain = page.all('.proj:not(.is-featured)')[0];

    expect(featured.getBoundingClientRect().width).toBeGreaterThan(
      plain.getBoundingClientRect().width * 1.6,
    );
    expect(page.one('.proj.is-featured .proj__detail').getBoundingClientRect().height)
      .toBeGreaterThan(40);

    page.destroy();
  });

  it('moves the stats into a single-column rail beside the prose when wide', () => {
    const wide = mountAt(1920);
    expect(wide.trackCount('.stats')).toBe(1);
    expect(wide.one('.stats').offsetLeft).toBeGreaterThan(wide.one('.about__prose').offsetLeft + 100);
    wide.destroy();

    const narrow = mountAt(900);
    expect(narrow.trackCount('.stats')).toBe(2);
    narrow.destroy();
  });

  it('keeps the monogram card from scaling with the page', () => {
    for (const width of [1440, 2560]) {
      const page = mountAt(width);
      expect(page.one('.mono-card__face').getBoundingClientRect().height)
        .withContext(`monogram height at ${width}px`)
        .toBeLessThan(420);
      page.destroy();
    }
  });
});
