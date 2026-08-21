import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PortfolioShell } from './portfolio-shell';

describe('PortfolioShell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortfolioShell],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the public chrome around the page', () => {
    const fixture = TestBed.createComponent(PortfolioShell);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('app-navbar')).toBeTruthy();
    expect(page.querySelector('app-footer')).toBeTruthy();
    expect(page.querySelector('app-home')).toBeTruthy();
    expect(page.querySelector('main')).toBeTruthy();
  });
});
