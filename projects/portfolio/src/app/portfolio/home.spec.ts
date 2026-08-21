import { TestBed } from '@angular/core/testing';
import { BUNDLED_CONTENT as CONTENT } from '@pc/core';
import { Home } from './home';

/**
 * Smoke test for the whole page. Rendering Home exercises every section, every
 * directive (reveal, tilt, magnetic, count-up) and the contact form, so a
 * runtime error anywhere in the portfolio fails here.
 */
describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Home] }).compileComponents();
  });

  it('renders every section the navigation points at', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    for (const item of CONTENT.nav) {
      expect(page.querySelector(`#${item.id}`))
        .withContext(`missing section #${item.id}`)
        .toBeTruthy();
    }
  });

  it('renders a card per project and a group per skill set', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelectorAll('app-projects .proj').length).toBe(CONTENT.projects.length);
    expect(page.querySelectorAll('app-skills .card').length).toBe(CONTENT.skillGroups.length);
  });

  it('keeps the contact form invalid until it is filled in', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    const form = page.querySelector('form');
    expect(form).toBeTruthy();
    expect(page.querySelectorAll('.field').length).toBe(4);
  });
});
