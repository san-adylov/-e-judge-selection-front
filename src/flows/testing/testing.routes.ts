import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { Routes } from '@angular/router';

import { access, stageSignIn } from '@shared/auth/guards';
import { ShellLayoutComponent } from '@shared/ui/layout/shell-layout.component';
import { CenteredLayoutComponent } from '@shared/ui/page/centered-layout.component';

import { screen } from '../screen';

@Component({
  selector: 'app-testing-shell',
  imports: [ShellLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-shell-layout area="testing" title="shell.area.testing" />`,
})
class TestingShellComponent {}

/** Тестирование и эссе по коду этапа (было `flows/test`). Один код — одно упражнение. */
export const TESTING_ROUTES: Routes = [
  {
    path: 'sign-in',
    component: CenteredLayoutComponent,
    canMatch: [stageSignIn],
    children: [{ path: '', title: 'shell.sign-in.testing', loadComponent: () => import('./pages/sign-in.page') }],
  },
  {
    path: '',
    component: TestingShellComponent,
    canMatch: [access('CANDIDATE')],
    children: [
      screen({
        path: 'quiz/:testId',
        title: 'shell.nav.quiz',
        access: 'CANDIDATE',
        api: [
          'GET /tests/{testId}',
          'POST /tests/{testId}/questions/{number}/answer',
          'POST /tests/{testId}/finish',
          'GET /tests/{testId}/result',
        ],
      }),
      screen({
        path: 'essay',
        title: 'shell.nav.essay',
        access: 'CANDIDATE',
        api: ['GET /essay/my', 'PUT /essay/my/reply'],
      }),
    ],
  },
];
