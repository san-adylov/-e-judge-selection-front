import type { Routes } from '@angular/router';

import { redirectHome } from '@shared/auth/guards';

/** Префиксы `/cabinet`, `/administrative`, `/testing` не меняются с v1. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: () => redirectHome() },
  { path: 'cabinet', loadChildren: () => import('@flows/cabinet/cabinet.routes').then((m) => m.CABINET_ROUTES) },
  {
    path: 'administrative',
    loadChildren: () => import('@flows/administrative/administrative.routes').then((m) => m.ADMINISTRATIVE_ROUTES),
  },
  { path: 'testing', loadChildren: () => import('@flows/testing/testing.routes').then((m) => m.TESTING_ROUTES) },
  {
    path: 'forbidden',
    title: 'shell.errors.forbidden.title',
    loadComponent: () => import('@flows/errors/error.page'),
    data: { code: 'forbidden' },
  },
  {
    path: '**',
    title: 'shell.errors.not-found.title',
    loadComponent: () => import('@flows/errors/error.page'),
    data: { code: 'not-found' },
  },
];
