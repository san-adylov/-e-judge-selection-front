import type { Routes } from '@angular/router';

import { access, guestOnly } from '@shared/auth/guards';
import { CenteredLayoutComponent } from '@shared/ui/page/centered-layout.component';

/** Кабинет: CANDIDATE (в группе и ACTIVE_JUDGE). Было `flows/application`. */
export const CABINET_ROUTES: Routes = [
  {
    path: 'sign-in',
    component: CenteredLayoutComponent,
    canMatch: [guestOnly],
    // Сюда же возвращается ЕСИА с `?code=&state=` — адрес возврата не меняется с v1.
    children: [{ path: '', title: 'shell.sign-in.title', loadComponent: () => import('./pages/sign-in.page') }],
  },
  {
    path: '',
    canMatch: [access('CANDIDATE')],
    loadComponent: () => import('./cabinet-shell.component'),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      { path: 'profile', title: 'shell.nav.profile', loadComponent: () => import('./pages/profile.page') },
      { path: 'contests', title: 'shell.nav.contests', loadComponent: () => import('./pages/contests/contests.page') },
      {
        path: 'contests/:id',
        title: 'shell.nav.contests',
        loadComponent: () => import('./pages/contests/contest-detail.page'),
      },
      {
        path: 'applications',
        title: 'shell.nav.applications',
        loadComponent: () => import('./pages/applications/applications.page'),
      },
      // Мастер — раньше карточки: `applications/:id` иначе перехватит `…/edit`.
      {
        path: 'applications/:id/edit',
        title: 'wizard.title',
        loadComponent: () => import('./pages/application-edit/application-edit.page'),
      },
      {
        path: 'applications/:id',
        title: 'shell.nav.applications',
        loadComponent: () => import('./pages/applications/application-detail.page'),
      },
      {
        path: 'vacancies',
        title: 'shell.nav.vacancies',
        loadComponent: () => import('./pages/vacancies/vacancies.page'),
      },
      { path: 'reserve', title: 'shell.nav.reserve', loadComponent: () => import('./pages/reserve/reserve.page') },
      {
        path: 'complaints',
        title: 'shell.nav.complaints',
        loadComponent: () => import('./pages/complaints/complaints.page'),
      },
      { path: 'results', title: 'shell.nav.results', loadComponent: () => import('./pages/results/results.page') },
      {
        path: 'judge-confirmation',
        title: 'shell.nav.judge-confirmation',
        loadComponent: () => import('./pages/judge-confirmation/judge-confirmation.page'),
      },
      {
        path: 'judge-applications',
        title: 'shell.nav.judge-applications',
        canMatch: [access('ACTIVE_JUDGE')],
        loadComponent: () => import('./pages/judge-applications/judge-applications.page'),
      },
      {
        path: 'judge-applications/:id',
        title: 'shell.nav.judge-applications',
        canMatch: [access('ACTIVE_JUDGE')],
        loadComponent: () => import('./pages/judge-applications/judge-application.page'),
      },
      {
        path: 'notifications',
        title: 'shell.notifications.title',
        loadComponent: () =>
          import('@features/notifications/notifications-page.component').then((m) => m.NotificationsPageComponent),
      },
    ],
  },
];
