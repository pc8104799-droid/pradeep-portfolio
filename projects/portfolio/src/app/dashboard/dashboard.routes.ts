import type { Routes } from '@angular/router';
import { DASHBOARD_PAGES } from './dashboard-nav';
import { DashboardShell } from './dashboard-shell';
import { DataPage } from './pages/data-page';
import { SectionPage } from './pages/section-page';

/**
 * Child routes come from DASHBOARD_PAGES, so adding a section to the resume
 * gives it a sidebar entry, a route, a preview and its editors with no extra
 * wiring here.
 */
export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashboardShell,
    children: [
      { path: '', redirectTo: DASHBOARD_PAGES[0].id, pathMatch: 'full' },
      ...DASHBOARD_PAGES.map((page) => ({
        path: page.id,
        component: SectionPage,
        data: { page },
        title: `${page.label} — Portfolio workspace`,
      })),
      { path: 'data', component: DataPage, title: 'Export & import — Portfolio workspace' },
      { path: '**', redirectTo: DASHBOARD_PAGES[0].id },
    ],
  },
];
