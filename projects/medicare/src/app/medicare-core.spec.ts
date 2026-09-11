import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActionState,
  ApiError,
  API_BASE_URL,
  AsyncState,
  AuthService,
  authInterceptor,
  errorInterceptor,
  PharmacyService,
  ThemeService,
  THEMES,
  TokenStore,
  ToastService,
  toParams,
} from '@pc/medicare-core';

const BASE = 'http://api.test/api';

/** Standard testing setup: real services, a faked HTTP backend. */
function setup() {
  TestBed.configureTestingModule({
    providers: [
      { provide: API_BASE_URL, useValue: BASE },
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
      provideHttpClientTesting(),
    ],
  });

  return TestBed.inject(HttpTestingController);
}

describe('AsyncState', () => {
  it('moves idle → loading → ready and reports empty results', async () => {
    const state = new AsyncState(async () => [] as string[]);

    expect(state.state()).toBe('idle');
    expect(state.empty()).toBeFalse();

    const pending = state.load();
    expect(state.loading()).toBeTrue();

    await pending;
    expect(state.ready()).toBeTrue();
    expect(state.empty()).toBeTrue();
  });

  it('treats an empty page envelope as empty', async () => {
    const state = new AsyncState(async () => ({ items: [], total: 0 }));
    await state.load();

    expect(state.empty()).toBeTrue();
  });

  it('keeps stale data visible while reloading', async () => {
    let count = 0;
    const state = new AsyncState(async () => [`run-${++count}`]);

    await state.load();
    expect(state.data()).toEqual(['run-1']);

    const second = state.load();
    // A second load is a *re*load: the first result is still on screen.
    expect(state.reloading()).toBeTrue();
    expect(state.loading()).toBeFalse();
    expect(state.data()).toEqual(['run-1']);

    await second;
    expect(state.data()).toEqual(['run-2']);
  });

  it('records the error and stops being ready when the loader throws', async () => {
    const state = new AsyncState(async () => {
      throw new ApiError(503, 'Service unavailable.');
    });

    await state.load();

    expect(state.failed()).toBeTrue();
    expect(state.error()?.status).toBe(503);
    expect(state.error()?.message).toBe('Service unavailable.');
  });

  /**
   * The race this guards is real: a filter change fires a second request while
   * the first is still in flight, and the slow one must not win.
   */
  it('discards a slow first response when a second load overtakes it', async () => {
    const gates: Array<(value: string) => void> = [];
    const state = new AsyncState(
      () => new Promise<string>((resolve) => gates.push(resolve)),
    );

    const first = state.load();
    const second = state.load();

    gates[1]('second');
    await second;
    expect(state.data()).toBe('second');

    gates[0]('first');
    await first;
    expect(state.data()).toBe('second');
  });
});

describe('ActionState', () => {
  it('returns the result and clears busy on success', async () => {
    const action = new ActionState();
    const result = await action.run(async () => 'saved');

    expect(result).toBe('saved');
    expect(action.busy()).toBeFalse();
    expect(action.error()).toBeNull();
  });

  it('captures field errors instead of throwing', async () => {
    const action = new ActionState();

    const result = await action.run(async () => {
      throw new ApiError(400, 'Some fields need attention.', { email: 'Already in use.' });
    });

    expect(result).toBeNull();
    expect(action.error()?.hasFieldErrors).toBeTrue();
    expect(action.fieldErrors()['email']).toBe('Already in use.');
  });

  it('ignores a second run while the first is still going', async () => {
    const action = new ActionState();
    let calls = 0;

    const slow = action.run(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return calls;
    });

    expect(await action.run(async () => (calls += 1))).toBeNull();
    await slow;

    expect(calls).toBe(1);
  });
});

describe('ApiError', () => {
  it('unwraps the API envelope', () => {
    const error = ApiError.from({
      status: 403,
      statusText: 'Forbidden',
      error: { error: { status: 403, message: 'Not yours.', details: { id: 'nope' } } },
    } as never);

    expect(error.status).toBe(403);
    expect(error.isForbidden).toBeTrue();
    expect(error.details['id']).toBe('nope');
  });

  it('turns an unreachable server into an actionable message', () => {
    const error = ApiError.from({ status: 0, statusText: 'Unknown Error', error: null } as never);

    expect(error.status).toBe(0);
    expect(error.message).toContain('npm run api');
  });
});

describe('toParams', () => {
  it('drops blanks so filter URLs stay clean', () => {
    const params = toParams({ q: 'heart', status: '', page: 2, gender: 'all', missing: undefined });

    expect(params.get('q')).toBe('heart');
    expect(params.get('page')).toBe('2');
    expect(params.has('status')).toBeFalse();
    expect(params.has('gender')).toBeFalse();
    expect(params.has('missing')).toBeFalse();
  });
});

describe('authInterceptor', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    http = setup();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('adds the bearer token to our own API only', async () => {
    TestBed.inject(TokenStore).set('test-token');
    const api = TestBed.inject(AuthService);

    void api.demoAccounts();
    const request = http.expectOne(`${BASE}/auth/demo-accounts`);

    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ password: 'x', accounts: [] });
  });

  it('drops the session on a 401 from anything but the login call', async () => {
    const tokens = TestBed.inject(TokenStore);
    tokens.set('expired');

    const auth = TestBed.inject(AuthService);
    const restored = auth.restore();

    http.expectOne(`${BASE}/auth/me`).flush(
      { error: { status: 401, message: 'Your session has expired.' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    await restored;
    expect(tokens.token()).toBeNull();
    expect(auth.signedIn()).toBeFalse();
  });

  it('keeps the token when the login call itself is rejected', async () => {
    const tokens = TestBed.inject(TokenStore);
    tokens.set('still-valid');

    const auth = TestBed.inject(AuthService);
    const attempt = auth.login('someone@example.com', 'wrong').catch((error) => error);

    http.expectOne(`${BASE}/auth/login`).flush(
      { error: { status: 401, message: 'Those details do not match an account.' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    const error = await attempt;
    expect(error.message).toContain('do not match');
    expect(tokens.token()).toBe('still-valid');
  });
});

describe('AuthService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    http = setup();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('routes each role to its own panel', async () => {
    const auth = TestBed.inject(AuthService);
    const login = auth.login('dr.mehta@medicare360.in', 'Medicare@360');

    http.expectOne(`${BASE}/auth/login`).flush({
      token: 'jwt',
      expiresIn: 3600,
      user: {
        id: 'USR-1',
        email: 'dr.mehta@medicare360.in',
        role: 'doctor',
        name: 'Dr Anaya Mehta',
        profileId: 'DR-000001',
      },
      profile: null,
    });

    await login;

    expect(auth.signedIn()).toBeTrue();
    expect(auth.role()).toBe('doctor');
    expect(auth.profileId()).toBe('DR-000001');
    expect(auth.homeRoute()).toBe('/doctor/dashboard');
    expect(auth.has('doctor')).toBeTrue();
    expect(auth.has('patient')).toBeFalse();
  });

  it('clears everything on sign-out', async () => {
    const auth = TestBed.inject(AuthService);
    const login = auth.login('a@b.com', 'x');

    http.expectOne(`${BASE}/auth/login`).flush({
      token: 'jwt',
      expiresIn: 3600,
      user: { id: 'USR-1', email: 'a@b.com', role: 'patient', name: 'A', profileId: 'PT-000001' },
      profile: null,
    });

    await login;
    auth.logout();

    expect(auth.signedIn()).toBeFalse();
    expect(auth.profileId()).toBeNull();
    expect(TestBed.inject(TokenStore).token()).toBeNull();
  });
});

describe('PharmacyService basket', () => {
  let http: HttpTestingController;
  let cart: PharmacyService;

  beforeEach(() => {
    localStorage.clear();
    http = setup();
    cart = TestBed.inject(PharmacyService);
    cart.clear();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('adds, increments and removes lines', () => {
    cart.add('MED-000001');
    cart.add('MED-000001', 2);
    cart.add('MED-000002');

    expect(cart.count()).toBe(4);
    expect(cart.quantityOf('MED-000001')).toBe(3);

    cart.remove('MED-000001');
    expect(cart.count()).toBe(1);
    expect(cart.isEmpty()).toBeFalse();

    cart.clear();
    expect(cart.isEmpty()).toBeTrue();
  });

  it('clamps quantity and removes the line at zero', () => {
    cart.add('MED-000001');
    cart.setQuantity('MED-000001', 99);
    expect(cart.quantityOf('MED-000001')).toBe(10);

    cart.setQuantity('MED-000001', 0);
    expect(cart.isEmpty()).toBeTrue();
  });

  /** The basket must never send a price — that is the server's job. */
  it('sends only ids and quantities when asking for a quote', () => {
    cart.add('MED-000001', 2);
    cart.applyCoupon('firstcare');
    cart.attachPrescription('RX-000001');

    void cart.quote();
    const request = http.expectOne(`${BASE}/pharmacy/quote`);

    expect(request.request.body).toEqual({
      lines: [{ medicineId: 'MED-000001', quantity: 2 }],
      couponCode: 'FIRSTCARE',
      prescriptionId: 'RX-000001',
    });

    request.flush({ lines: [], blocked: [], outOfStock: [], coupon: null, couponError: null, prescriptionStatus: 'not-required', bill: { itemsTotal: 0, discount: 0, delivery: 0, tax: 0, total: 0 } });
  });

  it('survives a corrupt stored basket', () => {
    localStorage.setItem('medicare360-cart', '{not json');
    TestBed.resetTestingModule();
    setup();

    expect(TestBed.inject(PharmacyService).isEmpty()).toBeTrue();
  });
});

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.clear());

  it('writes the theme to the document root and remembers it', () => {
    const theme = TestBed.inject(ThemeService);

    for (const option of THEMES) {
      theme.set(option.id);
      TestBed.tick();

      expect(document.documentElement.dataset['theme']).toBe(option.id);
      expect(localStorage.getItem('medicare360-theme')).toBe(option.id);
    }
  });

  it('toggles between light and dark', () => {
    const theme = TestBed.inject(ThemeService);

    theme.set('light');
    theme.toggle();
    expect(theme.theme()).toBe('dark');
    expect(theme.isDark()).toBeTrue();

    theme.toggle();
    expect(theme.theme()).toBe('light');
  });

  it('applies the density to the document root', () => {
    const theme = TestBed.inject(ThemeService);

    theme.setDensity('compact');
    TestBed.tick();
    expect(document.documentElement.dataset['density']).toBe('compact');
  });
});

describe('ToastService', () => {
  it('keeps at most three toasts, newest last', () => {
    const toasts = TestBed.inject(ToastService);

    toasts.success('one');
    toasts.info('two');
    toasts.warning('three');
    toasts.error('four');

    const titles = toasts.toasts().map((toast) => toast.title);
    expect(titles).toEqual(['two', 'three', 'four']);
  });
});
