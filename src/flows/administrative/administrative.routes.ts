import type { Routes } from '@angular/router';

import { access, guestOnly } from '@shared/auth/guards';
import { CenteredLayoutComponent } from '@shared/ui/page/centered-layout.component';

/**
 * Административная часть: один маршрут — один экран для всех ролей группы (было `flows/admin` +
 * `areas/{chairman,board-member,secretary}`). Различия ролей — через группы доступа, а не копии страниц.
 */
export const ADMINISTRATIVE_ROUTES: Routes = [
  {
    path: 'sign-in',
    component: CenteredLayoutComponent,
    canMatch: [guestOnly],
    children: [{ path: '', title: 'shell.sign-in.title', loadComponent: () => import('./pages/sign-in.page') }],
  },
  {
    path: '',
    canMatch: [access('STAFF')],
    loadComponent: () => import('./administrative-shell.component'),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'shell.nav.dashboard', loadComponent: () => import('./pages/dashboard.page') },
      {
        path: 'contests',
        title: 'shell.nav.contests',
        loadComponent: () => import('./pages/contests/contests.page'),
      },
      {
        path: 'contests/:id/edit',
        title: 'shell.nav.contests',
        canMatch: [access('SECRETARY')],
        loadComponent: () => import('./pages/contests/contest-edit.page'),
      },
      {
        path: 'contests/:id',
        title: 'shell.nav.contests',
        loadComponent: () => import('./pages/contests/contest-detail.page'),
      },
      {
        path: 'applications',
        title: 'shell.nav.applications',
        canMatch: [access('COUNCIL')],
        loadComponent: () => import('./pages/applications/applications.page'),
      },
      {
        path: 'applications/:id',
        title: 'shell.nav.applications',
        canMatch: [access('COUNCIL')],
        loadComponent: () => import('./pages/applications/application-detail.page'),
      },
      {
        path: 'document-assessment',
        title: 'shell.nav.document-assessment',
        canMatch: [access('COUNCIL')],
        loadComponent: () => import('./pages/assessment/document-assessment.page'),
      },
      {
        path: 'essay-review',
        title: 'shell.nav.essay-review',
        canMatch: [access('BOARD')],
        loadComponent: () => import('./pages/essay-review/essay-review.page'),
      },
      {
        path: 'interviews',
        title: 'shell.nav.interviews',
        canMatch: [access('BOARD')],
        loadComponent: () => import('./pages/interviews/interviews.page'),
      },
      { path: 'meetings', title: 'shell.nav.meetings', loadComponent: () => import('./pages/meetings/meetings.page') },
      {
        path: 'meetings/:id',
        title: 'shell.nav.meetings',
        loadComponent: () => import('./pages/meetings/meeting-detail.page'),
      },
      {
        path: 'decisions',
        title: 'shell.nav.decisions',
        loadComponent: () => import('./pages/meetings/decisions.page'),
      },
      {
        path: 'results/:contestId',
        title: 'shell.nav.results',
        loadComponent: () => import('./pages/results/results.page'),
      },
      { path: 'reserve', title: 'shell.nav.reserve', loadComponent: () => import('./pages/reserve/reserve.page') },
      {
        path: 'vacancies',
        title: 'shell.nav.vacancies',
        loadComponent: () => import('./pages/vacancies/vacancies.page'),
      },
      {
        path: 'vacancies/:id',
        title: 'shell.nav.vacancies',
        loadComponent: () => import('./pages/vacancies/vacancy-detail.page'),
      },
      {
        path: 'complaints',
        title: 'shell.nav.complaints',
        loadComponent: () => import('./pages/complaints/complaints.page'),
      },
      { path: 'judges', title: 'shell.nav.judges', loadComponent: () => import('./pages/judges/judges.page') },
      {
        path: 'judges/applications/:id',
        title: 'shell.nav.judges',
        loadComponent: () => import('./pages/judges/judge-application.page'),
      },
      {
        path: 'judges/confirmations/:id',
        title: 'shell.nav.judges',
        loadComponent: () => import('./pages/judges/confirmation.page'),
      },
      {
        path: 'candidates/:userId',
        title: 'shell.nav.candidate',
        loadComponent: () => import('./pages/candidates/candidate.page'),
      },
      { path: 'tests', title: 'shell.nav.tests', loadComponent: () => import('./pages/tests/tests.page') },
      {
        path: 'essay-topics',
        title: 'shell.nav.essay-topics',
        canMatch: [access('ADMIN')],
        loadComponent: () => import('./pages/essay-topics/essay-topics.page'),
      },
      {
        path: 'directories',
        title: 'shell.nav.directories',
        canMatch: [access('ADMIN')],
        loadComponent: () => import('./pages/directories/directories.page'),
      },
      {
        path: 'users',
        title: 'shell.nav.users',
        canMatch: [access(['ADMIN', 'CHAIRMAN'])],
        loadComponent: () => import('./pages/users/users.page'),
      },
      {
        path: 'audit',
        title: 'shell.nav.audit',
        canMatch: [access('ADMIN')],
        loadComponent: () => import('./pages/audit/audit.page'),
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
