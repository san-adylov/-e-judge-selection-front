import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import { TestsApi } from '@domain/api/tests.api';
import { QUIZ_ERRORS, quizAccess, type TestResult } from '@features/quiz/quiz.logic';
import { QuizResultComponent } from '@features/quiz/quiz-result.component';
import { StageExitComponent } from '@features/stage-timer/stage-exit.component';
import { apiErrorOf } from '@shared/api/api-error';
import { skipErrorToast } from '@shared/api/http-context';
import { homeUrl } from '@shared/auth/areas';
import { SessionService } from '@shared/auth/session.service';

import { resultStateFor } from './quiz-page.logic';

/**
 * `/testing/quiz/:testId/result` — итог завершённого теста. Сразу после завершения результат приходит
 * в `history.state`, после перезагрузки — `GET /tests/{id}/result`; незавершённый тест (4119) — обратно к вопросам.
 */
@Component({
  selector: 'app-quiz-result-page',
  imports: [LangPipe, Button, Message, Skeleton, QuizResultComponent, StageExitComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-4">
      @if (loading()) {
        <div
          class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-6"
          aria-busy="true"
        >
          <p-skeleton height="3.5rem" width="3.5rem" shape="circle" styleClass="mx-auto" />
          <p-skeleton height="2rem" width="60%" styleClass="mx-auto" />
          <p-skeleton height="5rem" />
        </div>
      } @else if (error() !== null) {
        <section class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
          <h1 class="m-0 text-xl font-semibold">{{ 'quiz.result.title' | lang }}</h1>
          <p-message severity="error" [text]="error() || ('quiz.result.load-error' | lang)" />
          <div class="flex flex-col gap-2 tablet:flex-row">
            <p-button icon="pi pi-refresh" [label]="'quiz.error.retry' | lang" (onClick)="load()" />
            <app-stage-exit />
          </div>
        </section>
      } @else {
        <app-quiz-result [result]="result()" [timeUp]="timeUp()" />
      }
    </div>
  `,
})
export default class QuizResultPage implements OnInit {
  private readonly api = inject(TestsApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  readonly testId = input.required<string>();

  private id = 0;
  protected readonly loading = signal(true);
  /** `null` — нет ошибки, пустая строка — общая ошибка. */
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<TestResult | null>(null);
  protected readonly timeUp = signal(false);

  ngOnInit(): void {
    const access = quizAccess(this.testId(), this.session.stage());

    if (access.kind === 'redirect') {
      void this.router.navigateByUrl(homeUrl(this.session.session()), { replaceUrl: true });

      return;
    }

    this.id = access.testId;

    const state = resultStateFor(this.location.getState(), this.id);

    this.timeUp.set(state?.timeUp ?? false);

    if (state?.quizResult) {
      this.result.set(state.quizResult);
      this.loading.set(false);

      return;
    }

    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .result(this.id, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          const apiError = apiErrorOf(error);

          // Тест ещё идёт — результата нет, возвращаем к вопросам.
          if (apiError?.errorCode === QUIZ_ERRORS.NOT_FINISHED) {
            void this.router.navigate(['/testing/quiz', this.id], { replaceUrl: true });

            return;
          }

          this.error.set(apiError?.message ?? '');
          this.loading.set(false);
        },
      });
  }
}
