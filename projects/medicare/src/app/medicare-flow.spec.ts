import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  API_BASE_URL,
  AuthService,
  authInterceptor,
  errorInterceptor,
  TokenStore,
  type Role,
} from '@pc/medicare-core';
import { routes } from './app.routes';
import {
  ClockPipe,
  DayPipe,
  InitialsPipe,
  InrPipe,
  LabelPipe,
  ListOrPipe,
  WhenPipe,
} from './shared/pipes';

const BASE = 'http://api.test/api';

function configure() {
  TestBed.configureTestingModule({
    providers: [
      { provide: API_BASE_URL, useValue: BASE },
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
      provideHttpClientTesting(),
      provideRouter(routes, withComponentInputBinding()),
    ],
  });
}

/**
 * Lets pending microtasks run.
 *
 * `flush()` delivers the response synchronously, but the service awaits it, so
 * the signal it writes is one or two microtasks behind — asserting immediately
 * would read the pre-response state.
 */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Puts a signed-in account of the given role in place without a real login. */
async function signInAs(role: Role, profileId: string): Promise<void> {
  const http = TestBed.inject(HttpTestingController);
  const auth = TestBed.inject(AuthService);

  TestBed.inject(TokenStore).set('test-token');
  const restored = auth.restore();

  http.expectOne(`${BASE}/auth/me`).flush({
    user: { id: 'USR-1', email: `${role}@medicare360.in`, role, name: 'Test User', profileId },
    profile: null,
  });

  await restored;
}

describe('route guards', () => {
  beforeEach(() => {
    localStorage.clear();
    configure();
  });

  afterEach(() => localStorage.clear());

  it('sends a visitor to sign-in and remembers where they were going', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/patient/appointments');

    const router = TestBed.inject(Router);
    expect(router.url).toContain('/login');
    expect(router.url).toContain('next=%2Fpatient%2Fappointments');
  });

  it('lands a visitor on the sign-in screen from the root', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('keeps a patient out of the doctor panel and says why', async () => {
    await signInAs('patient', 'PT-000001');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/doctor/queue');

    const url = TestBed.inject(Router).url;
    expect(url).toContain('/patient/dashboard');
    expect(url).toContain('denied=%2Fdoctor%2Fqueue');
  });

  it('keeps a doctor out of the patient panel', async () => {
    await signInAs('doctor', 'DR-000001');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/patient/pharmacy');

    expect(TestBed.inject(Router).url).toContain('/doctor/dashboard');
  });

  it('sends a signed-in account away from the sign-in screen', async () => {
    await signInAs('patient', 'PT-000001');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');

    expect(TestBed.inject(Router).url).toBe('/patient/dashboard');
  });

  it('routes reception and pharmacy accounts into the patient shell', async () => {
    await signInAs('admin', 'BR-000001');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/patient/dashboard');
  });
});

describe('sign-in screen', () => {
  beforeEach(() => {
    localStorage.clear();
    configure();
  });

  afterEach(() => localStorage.clear());

  it('offers the demo accounts the API reports', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${BASE}/auth/demo-accounts`).flush({
      password: 'Medicare@360',
      accounts: [
        { role: 'patient', email: 'aarav.sharma@example.com', name: 'Aarav Sharma' },
        { role: 'doctor', email: 'dr.mehta@medicare360.in', name: 'Dr Anaya Mehta' },
      ],
    });

    await settle();
    harness.detectChanges();
    const page = harness.routeNativeElement as HTMLElement;

    expect(page.querySelectorAll('.demo__account').length).toBe(2);
    expect(page.textContent).toContain('aarav.sharma@example.com');
    expect(page.textContent).toContain('Medicare@360');
  });

  it('explains itself when the API is not running', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');

    TestBed.inject(HttpTestingController)
      .expectOne(`${BASE}/auth/demo-accounts`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    await settle();
    harness.detectChanges();
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('npm run api');
  });
});

describe('not-found page', () => {
  beforeEach(() => {
    localStorage.clear();
    configure();
  });

  afterEach(() => localStorage.clear());

  it('offers a signed-in visitor a way back', async () => {
    await signInAs('patient', 'PT-000001');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/patient/this-does-not-exist');
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    expect(page.textContent).toContain('does not exist');
    expect(page.querySelector('a[href="/patient/dashboard"]')).not.toBeNull();
  });
});

describe('formatting pipes', () => {
  it('formats rupees with Indian grouping and no stray decimals', () => {
    const inr = new InrPipe();

    expect(inr.transform(1240)).toBe('₹1,240');
    expect(inr.transform(125_000)).toBe('₹1,25,000');
    expect(inr.transform(0)).toBe('₹0');
    expect(inr.transform(null)).toBe('—');
  });

  it('formats dates and times the way a clinic reads them', () => {
    const day = new DayPipe();
    const clock = new ClockPipe();

    // Chrome renders the en-IN short month as "Sep" or "Sept" depending on
    // its ICU build, so match the parts that are stable.
    expect(day.transform('2026-09-11')).toMatch(/Fri.*11 Sept?.*2026/);
    expect(day.transform('2026-09-11', 'short')).toMatch(/^11 Sept?$/);
    expect(day.transform('2026-09-11', 'month')).toMatch(/September 2026/);
    expect(day.transform(null)).toBe('—');

    expect(clock.transform('09:30')).toBe('9:30 am');
    expect(clock.transform('14:05')).toBe('2:05 pm');
    expect(clock.transform('00:15')).toBe('12:15 am');
    expect(clock.transform('12:00')).toBe('12:00 pm');
  });

  it('describes recent timestamps relatively', () => {
    const when = new WhenPipe();

    expect(when.transform(new Date().toISOString())).toBe('just now');
    expect(when.transform(new Date(Date.now() - 3 * 3600_000).toISOString())).toContain('hours ago');
    expect(when.transform(new Date(Date.now() + 2 * 86_400_000).toISOString())).toContain('in 2 days');
  });

  it('turns API enums into labels and lists into prose', () => {
    expect(new LabelPipe().transform('in-consultation')).toBe('In consultation');
    expect(new LabelPipe().transform('no-show')).toBe('No show');

    expect(new ListOrPipe().transform(['Penicillin', 'Dust'])).toBe('Penicillin, Dust');
    expect(new ListOrPipe().transform([])).toBe('None recorded');
    expect(new ListOrPipe().transform([], '—')).toBe('—');
  });

  it('builds initials, dropping a doctor title', () => {
    const initials = new InitialsPipe();

    expect(initials.transform('Dr Anaya Mehta')).toBe('AM');
    expect(initials.transform('Aarav Sharma')).toBe('AS');
    expect(initials.transform('Cher')).toBe('C');
  });
});
