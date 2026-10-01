import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { Routes } from '@angular/router';

import { access, stageSignIn } from '@shared/auth/guards';
import { ShellLayoutComponent } from '@shared/ui/layout/shell-layout.component';
import { CenteredLayoutComponent } from '@shared/ui/page/centered-layout.component';

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
      // `:testId` — `exerciseId` из токена этапа; чужой id страница отправляет на свой экран.
      { path: 'quiz/:testId', title: 'shell.nav.quiz', loadComponent: () => import('./pages/quiz/quiz.page') },
      {
        path: 'quiz/:testId/result',
        title: 'shell.nav.quiz',
        loadComponent: () => import('./pages/quiz/quiz-result.page'),
      },
      { path: 'essay', title: 'shell.nav.essay', loadComponent: () => import('./pages/essay/essay.page') },
    ],
  },
];
