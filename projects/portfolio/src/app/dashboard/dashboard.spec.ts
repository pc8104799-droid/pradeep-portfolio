import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService, ContentService, SECTION_BY_ID } from '@pc/core';
import { DASHBOARD_PAGES } from './dashboard-nav';
import { DASHBOARD_ROUTES } from './dashboard.routes';

describe('dashboard', () => {
  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'dashboard', children: DASHBOARD_ROUTES }])],
    });
    await TestBed.inject(AuthService).register('Test', 'a@b.com', 'longenough1');
  });

  afterEach(() => localStorage.clear());

  it('gives every resume section a route that renders', async () => {
    const harness = await RouterTestingHarness.create();

    for (const page of DASHBOARD_PAGES) {
      await harness.navigateByUrl(`/dashboard/${page.id}`);
      harness.detectChanges();

      const pane = harness.routeNativeElement as HTMLElement;
      expect(pane.textContent)
        .withContext(`page ${page.id} did not render`)
        .toContain(page.blurb);
    }
  });

  it('redirects the bare dashboard path to the first section', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');

    expect(TestBed.inject(Router).url).toBe(`/dashboard/${DASHBOARD_PAGES[0].id}`);
  });

  it('shows the live section on the preview tab', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard/projects');
    harness.detectChanges();

    const pane = harness.routeNativeElement as HTMLElement;
    expect(pane.querySelector('app-projects')).toBeTruthy();
    expect(pane.querySelector('app-collection-editor')).toBeNull();
  });

  it('swaps to the editors on the edit tab', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard/skills');
    harness.detectChanges();

    const pane = harness.routeNativeElement as HTMLElement;
    const editTab = Array.from(pane.querySelectorAll('.tabs button')).at(-1) as HTMLButtonElement;
    editTab.click();
    harness.detectChanges();

    // The skills page edits two collections: the core stack and the groups.
    expect(pane.querySelectorAll('app-collection-editor').length).toBe(2);
    expect(pane.querySelector('app-skills')).toBeNull();
  });

  it('edits, adds and deletes entries from a section', async () => {
    const harness = await RouterTestingHarness.create();
    const content = TestBed.inject(ContentService);
    await harness.navigateByUrl('/dashboard/contact');
    harness.detectChanges();

    const pane = harness.routeNativeElement as HTMLElement;
    (Array.from(pane.querySelectorAll('.tabs button')).at(-1) as HTMLButtonElement).click();
    harness.detectChanges();

    const before = content.socials().length;

    // Add
    (pane.querySelector('.editor-bar .btn') as HTMLButtonElement).click();
    harness.detectChanges();
    const fields = SECTION_BY_ID.get('socials')!.fields.length;
    expect(pane.querySelectorAll('pc-field').length).toBe(fields);

    // Delete the first existing entry
    (pane.querySelector('.row__tools .is-danger') as HTMLButtonElement).click();
    harness.detectChanges();
    (pane.querySelector('.link--danger') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(content.socials().length).toBe(before - 1);
  });
});
