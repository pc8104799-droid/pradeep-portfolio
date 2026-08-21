import { TestBed } from '@angular/core/testing';
import { BUNDLED_CONTENT as CONTENT } from '@pc/core';
import { Skills } from './skills';

describe('Skills', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Skills] }).compileComponents();
  });

  it('renders a card per group and a tag per skill', () => {
    const fixture = TestBed.createComponent(Skills);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.card').length).toBe(CONTENT.skillGroups.length);
    expect(host.querySelectorAll('.tag').length).toBe(
      CONTENT.skillGroups.reduce((sum, group) => sum + group.skills.length, 0),
    );
  });

  it('shows no numeric proficiency ratings anywhere', () => {
    const fixture = TestBed.createComponent(Skills);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    for (const tag of Array.from(host.querySelectorAll('.tag'))) {
      expect(tag.textContent?.trim()).not.toMatch(/\d{2}%?$/);
    }

    expect(host.querySelector('.meter')).toBeNull();
  });

  it('brings the tags to full opacity once the card is revealed', () => {
    const fixture = TestBed.createComponent(Skills);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);

    const card = host.querySelector('.card')!;
    const tag = card.querySelector('.tag') as HTMLElement;

    // Do not read opacity before adding the class: that starts the transition,
    // and the computed value would report the animating state, not the target.
    card.classList.add('is-visible');
    expect(getComputedStyle(tag).opacity).toBe('1');

    host.remove();
  });
});
