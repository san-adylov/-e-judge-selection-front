import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';

import { StageExitComponent } from '@features/stage-timer/stage-exit.component';

import { resultSummary, type TestResult } from './quiz.logic';

/**
 * Итог теста (`TestResultResponse`). Бэкенд показывает результат сразу после завершения;
 * если счёта нет — «результат будет в Личном кабинете». После завершения токен этапа не нужен — «Выйти».
 */
@Component({
  selector: 'app-quiz-result',
  imports: [LangPipe, Message, Tag, StageExitComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-5 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-6">
      <header class="flex flex-col items-center gap-3 text-center">
        <span
          class="flex size-14 items-center justify-center rounded-full"
          [class]="timeUp() ? 'bg-amber-100 text-amber-800' : 'bg-primary-50 text-primary'"
          aria-hidden="true"
        >
          <i class="pi text-2xl" [class]="timeUp() ? 'pi-clock' : 'pi-check-circle'"></i>
        </span>
        <h1 class="m-0 text-xl font-semibold tablet:text-2xl">
          {{ (timeUp() ? 'quiz.result.time-up-title' : 'quiz.result.sent-title') | lang }}
        </h1>
        @if (timeUp()) {
          <p class="m-0 text-sm text-surface-600">{{ 'quiz.result.time-up' | lang }}</p>
        }
      </header>

      @let s = summary();
      @if (s && s.correct !== null) {
        <dl class="m-0 grid gap-3 tablet:grid-cols-3">
          <div class="rounded-lg bg-surface-50 p-3">
            <dt class="text-xs text-surface-500">{{ 'quiz.result.correct' | lang }}</dt>
            <dd class="m-0 mt-1 text-lg font-semibold">
              {{ 'quiz.result.correct-value' | lang: { correct: s.correct, total: s.questionCount } }}
            </dd>
          </div>
          <div class="rounded-lg bg-surface-50 p-3">
            <dt class="text-xs text-surface-500">{{ 'quiz.result.percent' | lang }}</dt>
            <dd class="m-0 mt-1 text-lg font-semibold">{{ s.percent ?? 0 }} %</dd>
          </div>
          <div class="rounded-lg bg-surface-50 p-3">
            <dt class="text-xs text-surface-500">{{ 'quiz.result.passing' | lang }}</dt>
            <dd class="m-0 mt-1 text-lg font-semibold">
              {{ 'quiz.result.passing-value' | lang: { count: s.passing } }}
            </dd>
          </div>
        </dl>

        @if (s.passed !== null) {
          <div class="flex flex-col items-start gap-2">
            <p-tag
              [severity]="s.passed ? 'success' : 'danger'"
              [icon]="s.passed ? 'pi pi-check' : 'pi pi-times'"
              [value]="(s.passed ? 'quiz.result.passed' : 'quiz.result.failed') | lang"
            />
            <p class="m-0 text-sm text-surface-700">
              {{ (s.passed ? 'quiz.result.passed-text' : 'quiz.result.failed-text') | lang }}
            </p>
          </div>
        }
      } @else {
        <p-message severity="info" [text]="'quiz.result.later' | lang" />
      }

      <div class="flex flex-col gap-2 border-t border-surface-200 pt-4 tablet:flex-row tablet:items-center">
        <app-stage-exit [primary]="true" />
        <span class="text-xs text-surface-500">{{ 'quiz.result.logout-hint' | lang }}</span>
      </div>
    </section>
  `,
})
export class QuizResultComponent {
  /** `null` — результат недоступен. */
  readonly result = input<TestResult | null>(null);
  readonly timeUp = input(false);

  protected readonly summary = computed(() => {
    const result = this.result();

    return result ? resultSummary(result) : null;
  });
}
