import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@pc/core';
import { routes } from '../app.routes';

describe('AuthService', () => {
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => localStorage.clear());

  it('starts signed out with no accounts', () => {
    expect(auth.signedIn()).toBeFalse();
    expect(auth.hasAccounts()).toBeFalse();
  });

  it('registers an account and signs the user in', async () => {
    const user = await auth.register('Test Person', 'Test@Example.com ', 'longenough1');

    expect(user.name).toBe('Test Person');
    // Emails are normalised so casing cannot create a second account.
    expect(user.email).toBe('test@example.com');
    expect(auth.signedIn()).toBeTrue();
    expect(auth.hasAccounts()).toBeTrue();
  });

  it('never stores the password itself', async () => {
    await auth.register('Test', 'a@b.com', 'super-secret-1');
    const stored = localStorage.getItem('pc-accounts') ?? '';

    expect(stored).not.toContain('super-secret-1');
    expect(stored).toContain('salt');
  });

  it('refuses a duplicate email', async () => {
    await auth.register('Test', 'a@b.com', 'longenough1');
    await expectAsync(auth.register('Other', 'A@B.com', 'longenough2')).toBeRejectedWithError(
      /already exists/,
    );
  });

  it('signs in with the right password and rejects the wrong one', async () => {
    await auth.register('Test', 'a@b.com', 'longenough1');
    auth.logout();
    expect(auth.signedIn()).toBeFalse();

    await expectAsync(auth.login('a@b.com', 'wrong-password')).toBeRejected();
    expect(auth.signedIn()).toBeFalse();

    await auth.login('a@b.com', 'longenough1');
    expect(auth.signedIn()).toBeTrue();
  });

  it('gives the same message for an unknown email as a bad password', async () => {
    await auth.register('Test', 'a@b.com', 'longenough1');

    const unknown = await auth.login('nobody@b.com', 'x').catch((error: Error) => error.message);
    const wrong = await auth.login('a@b.com', 'x').catch((error: Error) => error.message);

    expect(unknown).toBe(wrong);
  });

  it('restores the session from storage', async () => {
    await auth.register('Test', 'a@b.com', 'longenough1');

    const fresh = TestBed.inject(AuthService);
    expect(fresh.signedIn()).toBeTrue();
  });
});

describe('route guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  afterEach(() => localStorage.clear());

  it('sends a visitor with no session to sign in', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard/overview');

    expect(TestBed.inject(Router).url).toContain('/login');
  });

  it('remembers where the visitor was heading', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard/projects');

    expect(TestBed.inject(Router).url).toContain('next=%2Fdashboard%2Fprojects');
  });

  it('lets a signed-in visitor through and keeps them off the login screen', async () => {
    await TestBed.inject(AuthService).register('Test', 'a@b.com', 'longenough1');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard/overview');
    expect(TestBed.inject(Router).url).toBe('/dashboard/overview');

    // The guard sends them to /dashboard, which lands on the first section.
    await harness.navigateByUrl('/login');
    expect(TestBed.inject(Router).url).toBe('/dashboard/overview');
  });

  it('leaves the public portfolio open to everyone', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/portfolio');

    expect(TestBed.inject(Router).url).toBe('/portfolio');
  });
});
