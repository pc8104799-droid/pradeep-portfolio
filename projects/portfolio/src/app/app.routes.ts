import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import { AuthService, authGuard, guestGuard } from '@pc/core';

/**
 * Signed-in visitors land in the workspace; everyone else starts at sign-in.
 * The public portfolio stays reachable either way.
 */
const landing = () => {
  const router = inject(Router);
  return router.createUrlTree([inject(AuthService).signedIn() ? '/dashboard' : '/login']);
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [landing], children: [] },

  // Auth — the first thing a new visitor sees.
  {
    path: '',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/auth-layout').then((m) => m.AuthLayout),
    children: [
      {
        path: 'login',
        loadComponent: () => import('./auth/login-page').then((m) => m.LoginPage),
        title: 'Sign in — Portfolio workspace',
      },
      {
        path: 'register',
        loadComponent: () => import('./auth/register-page').then((m) => m.RegisterPage),
        title: 'Create an account — Portfolio workspace',
      },
    ],
  },

  // The workspace: header, resume sections down the left, swappable centre pane.
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },

  // The public one-page portfolio — no account needed.
  {
    path: 'portfolio',
    loadComponent: () =>
      import('./portfolio/portfolio-shell').then((m) => m.PortfolioShell),
    title: 'Pradeep Chauhan — Senior Front-End Developer | Angular & TypeScript',
  },

  { path: '**', redirectTo: '' },
];
