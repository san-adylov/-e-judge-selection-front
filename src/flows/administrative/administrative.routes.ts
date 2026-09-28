import type { Routes } from '@angular/router';

import { access, guestOnly } from '@shared/auth/guards';
import { CenteredLayoutComponent } from '@shared/ui/page/centered-layout.component';

import { screen } from '../screen';

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
      screen({
        path: 'contests',
        title: 'shell.nav.contests',
        access: 'STAFF',
        actions: 'изменение — SECRETARY, создание и удаление — CHAIRMAN',
        api: ['GET /contest/all', 'GET /contest?status', 'POST /contest/create-name'],
      }),
      screen({
        path: 'contests/:id',
        title: 'shell.nav.contests',
        access: 'STAFF',
        actions: 'изменение — SECRETARY, создание и удаление — CHAIRMAN',
        api: [
          'GET /contest/{id}',
          'GET|PUT /contest/steps/{id}',
          'PUT /contest/{id}/stage-window/{stage}',
          'POST /contest/{id}/publish',
          'DELETE /contest/{id}',
        ],
      }),
      screen({
        path: 'applications',
        title: 'shell.nav.applications',
        access: 'COUNCIL',
        actions: 'список секретаря — SECRETARY, свои доклады — BOARD',
        api: [
          'GET /contest-application/by-contest/{id}',
          'GET /contest-application/for-secretary',
          'GET /contest-application/my-reporting',
          'PUT /contest-application/register/{id}',
          'PUT /contest-application/returned-for-correction/{id}',
          'PUT /contest-application/assign-board-member/{id}',
          'PATCH /contest-application/{id}/ready',
        ],
      }),
      screen({
        path: 'document-assessment',
        title: 'shell.nav.document-assessment',
        access: 'COUNCIL',
        actions: 'оценка — BOARD',
        api: ['GET|PUT /document-assessment', 'GET /document-assessment/summary'],
      }),
      screen({
        path: 'essay-review',
        title: 'shell.nav.essay-review',
        access: 'BOARD',
        api: ['GET /essay/reply', 'GET /essay/reply/progress', 'PUT /essay/reply/{id}/score'],
      }),
      screen({
        path: 'interviews',
        title: 'shell.nav.interviews',
        access: 'BOARD',
        api: ['GET /interviews', 'PATCH /interviews/assessment', 'GET /interviews/my'],
      }),
      screen({
        path: 'meetings',
        title: 'shell.nav.meetings',
        access: 'STAFF',
        actions: 'создание — COUNCIL',
        api: ['GET /meeting?status', 'POST /meeting'],
      }),
      screen({
        path: 'meetings/:id',
        title: 'shell.nav.meetings',
        access: 'STAFF',
        actions: 'голос — BOARD, разблокировка — CHAIRMAN',
        api: [
          'GET /meeting/{id}',
          'POST /meeting/{id}/join',
          'PUT /meeting/{id}/force-close',
          'PATCH /meeting/{id}/candidates/{applicationId}/unlock',
          'POST /vote',
          'GET /vote/{id}/summary',
          '/oep/*',
        ],
      }),
      screen({
        path: 'decisions',
        title: 'shell.nav.decisions',
        access: 'STAFF',
        actions: 'формирование — SECRETARY, утверждение — CHAIRMAN',
        api: [
          'GET /decision/by-meeting/{id}',
          'POST /decision/{id}/generate',
          'POST /decision/{id}/confirm',
          'GET /decision/{id}/download',
        ],
      }),
      screen({
        path: 'results/:contestId',
        title: 'shell.nav.results',
        access: 'STAFF',
        api: [
          'GET /contest-results/{id}/rating',
          'GET /contest-results/{id}/results',
          'GET /contest-results/{id}/passed-candidates',
          'GET /contest-results/{id}/reserve-candidates',
          'GET /contest-results/{id}/readiness',
          'POST /contest-results/{id}/reserve-list',
        ],
      }),
      screen({
        path: 'reserve',
        title: 'shell.nav.reserve',
        access: 'STAFF',
        api: ['GET /candidate/reserve', 'POST /candidate/reserve/{id}/exclude'],
      }),
      screen({
        path: 'vacancies',
        title: 'shell.nav.vacancies',
        access: 'STAFF',
        actions: 'создание и отмена — CHAIRMAN, публикация — SECRETARY',
        api: ['GET /vacancy', 'POST /vacancy'],
      }),
      screen({
        path: 'vacancies/:id',
        title: 'shell.nav.vacancies',
        access: 'STAFF',
        actions: 'создание и отмена — CHAIRMAN, публикация — SECRETARY',
        api: [
          'GET /vacancy/{id}',
          'POST /vacancy/{id}/publish',
          'POST /vacancy/{id}/cancel',
          'POST /vacancy/{id}/meeting',
          'POST /vacancy/{id}/select-from-reserve',
          'GET /vacancy-application/by-vacancy/{id}',
          'POST /vacancy-application/{id}/sunush',
        ],
      }),
      screen({
        path: 'complaints',
        title: 'shell.nav.complaints',
        access: 'STAFF',
        actions: 'заключение — SECRETARY',
        api: ['GET /complaints', 'POST /complaints/{id}/conclusion', 'GET|POST /complaint-reviews'],
      }),
      screen({
        path: 'judges',
        title: 'shell.nav.judges',
        access: 'STAFF',
        actions: 'регистрация и решения — SECRETARY, оценки — BOARD',
        api: [
          'GET /judge-applications',
          'GET /judge-applications/under-review',
          'GET /judge-applications/active-for-secretary',
          'GET /active-judge-confirmations',
          'POST /active-judge-confirmations/{id}/review|approve|reject',
        ],
      }),
      screen({
        path: 'candidates/:userId',
        title: 'shell.nav.candidate',
        access: 'STAFF',
        api: [
          'GET /candidate/profile/{userId}/full',
          'POST /candidate/profile/{userId}/presentation',
          'GET /candidate/{userId}/ban-status',
        ],
      }),
      screen({
        path: 'tests',
        title: 'shell.nav.tests',
        access: 'STAFF',
        actions: 'импорт — ADMIN, коды — SECRETARY',
        api: [
          'GET /questions',
          'GET /questions/categories',
          'POST /questions/import',
          'GET /tests',
          'POST /tests/codes/issue',
        ],
      }),
      screen({
        path: 'essay-topics',
        title: 'shell.nav.essay-topics',
        access: 'ADMIN',
        api: ['GET|POST /essay/topic', 'PUT|DELETE /essay/topic/{id}'],
      }),
      screen({
        path: 'directories',
        title: 'shell.nav.directories',
        access: 'ADMIN',
        api: [
          'GET /directory/{code}',
          '/holidays',
          '/reference',
          '/weights',
          '/schedule-settings',
          'GET /additional-info/questions/all',
        ],
      }),
      screen({
        path: 'users',
        title: 'shell.nav.users',
        access: 'STAFF',
        actions: 'изменение — ADMIN',
        api: ['GET /users', 'GET /users/board-members', 'PATCH /users/{id}/status', 'PUT /users/{id}/roles'],
      }),
      screen({
        path: 'audit',
        title: 'shell.nav.audit',
        access: 'ADMIN',
        api: ['GET /audit', 'GET /audit/users/{userId}'],
      }),
      {
        path: 'notifications',
        title: 'shell.notifications.title',
        loadComponent: () =>
          import('@features/notifications/notifications-page.component').then((m) => m.NotificationsPageComponent),
      },
    ],
  },
];
