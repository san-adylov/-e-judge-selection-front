import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, concatMap, EMPTY, map, type Observable, Subject, tap } from 'rxjs';

import { TestsApi } from '@domain/api/tests.api';
import { secondsLeft } from '@features/stage-timer/stage-timer.logic';
import { apiErrorOf } from '@shared/api/api-error';
import { skipErrorToast } from '@shared/api/http-context';

import {
  adjacentNumber,
  deadlineAt,
  nextUnanswered,
  paletteItems,
  QUIZ_ERRORS,
  sortQuestions,
  type TestResult,
  type TestView,
  toggleOption,
  unansweredNumbers,
} from './quiz.logic';
import { retryTransient, without } from './quiz-store.helpers';

/** `running` — идёт тест; `finishing` — запрос завершения в очереди; `finished` — можно показывать результат. */
export type QuizPhase = 'loading' | 'error' | 'running' | 'finishing' | 'finished';

/** Все запросы к тесту идут одной очередью: ответ не обгонит завершение, старый снимок не затрёт новый. */
type Job =
  { kind: 'answer'; number: number; optionIds: number[] } | { kind: 'finish'; auto: boolean } | { kind: 'sync' };

const TICK_MS = 500;

/**
 * Состояние прохождения теста (`GET/POST /tests/{id}…`). Предоставляется страницей.
 * Ответ на вопрос сохраняется один раз (4116), поэтому выбор копится в черновике до «Сохранить ответ».
 */
@Injectable()
export class QuizStore {
  private readonly api = inject(TestsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly jobs = new Subject<Job>();
  private testId = 0;

  private readonly state = signal<TestView | null>(null);
  private readonly deadline = signal<number | null>(null);
  private readonly now = signal(Date.now());

  readonly phase = signal<QuizPhase>('loading');
  /** Сообщение бэкенда при ошибке загрузки; пустая строка — общая ошибка. */
  readonly loadError = signal<string | null>(null);
  readonly finishError = signal<string | null>(null);
  readonly current = signal(1);
  readonly drafts = signal<ReadonlyMap<number, readonly number[]>>(new Map());
  readonly saving = signal<ReadonlySet<number>>(new Set());
  /** Номер вопроса → сообщение об ошибке сохранения (пустая строка — общая ошибка). */
  readonly failed = signal<ReadonlyMap<number, string>>(new Map());
  readonly result = signal<TestResult | null>(null);
  /** Тест завершён по истечении времени (таймер или 4133). */
  readonly timeUp = signal(false);

  readonly view = this.state.asReadonly();
  readonly questions = computed(() => sortQuestions(this.state()?.questions));
  readonly total = computed(() => this.state()?.questionCount ?? this.questions().length);
  readonly question = computed(() => this.questions().find((item) => item.number === this.current()) ?? null);
  readonly answeredCount = computed(() => this.questions().filter((item) => item.answered).length);
  readonly unanswered = computed(() => unansweredNumbers(this.questions()));
  readonly draftCount = computed(
    () => [...this.drafts().entries()].filter(([number, ids]) => ids.length && !this.saving().has(number)).length,
  );
  readonly secondsLeft = computed(() => {
    const deadline = this.deadline();

    return deadline === null ? null : secondsLeft(deadline, this.now());
  });

  /** Выбор текущего вопроса: сохранённый на сервере или черновик. */
  readonly selection = computed<readonly number[]>(() => {
    const question = this.question();

    if (!question) return [];
    if (question.answered) return question.selectedOptionIds ?? [];

    return this.drafts().get(question.number ?? 0) ?? [];
  });
  readonly currentSaving = computed(() => this.saving().has(this.current()));
  readonly currentError = computed(() => this.failed().get(this.current()) ?? null);
  readonly prevNumber = computed(() => adjacentNumber(this.questions(), this.current(), -1));
  readonly nextNumber = computed(() => adjacentNumber(this.questions(), this.current(), 1));
  readonly palette = computed(() =>
    paletteItems(this.questions(), this.current(), this.drafts(), this.saving(), new Set(this.failed().keys())),
  );

  constructor() {
    this.jobs
      .pipe(
        concatMap((job) => this.run(job)),
        takeUntilDestroyed(),
      )
      .subscribe();

    const ticker = setInterval(() => this.now.set(Date.now()), TICK_MS);
    const document = inject(DOCUMENT);
    // Вкладка в фоне могла пропустить автозавершение на сервере — сверяемся при возврате.
    const onVisible = () => document.visibilityState === 'visible' && this.sync();

    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(ticker);
      document.removeEventListener('visibilitychange', onVisible);
    });

    effect(() => {
      // Один автоматический запуск: при ошибке завершения страница предлагает повторить вручную.
      if (this.secondsLeft() === 0 && this.phase() === 'running' && !this.timeUp()) untracked(() => this.finish(true));
    });
  }

  load(testId: number): void {
    this.testId = testId;
    this.phase.set('loading');
    this.loadError.set(null);
    this.api.view(testId, skipErrorToast()).subscribe({
      next: (view) => {
        this.apply(view);
        this.current.set(nextUnanswered(this.questions(), 0) ?? this.questions()[0]?.number ?? 1);
        if (!view.finished) this.phase.set('running');
      },
      error: (error: unknown) => {
        this.loadError.set(apiErrorOf(error)?.message ?? '');
        this.phase.set('error');
      },
    });
  }

  go(number: number): void {
    if (this.questions().some((item) => item.number === number)) this.current.set(number);
  }

  select(optionId: number): void {
    const question = this.question();
    const number = question?.number ?? 0;

    if (!question || question.answered || this.saving().has(number) || this.phase() !== 'running') return;

    this.drafts.update((drafts) =>
      new Map(drafts).set(number, toggleOption(question.choiceType, drafts.get(number) ?? [], optionId)),
    );
    this.clearFailure(number);
  }

  /** Сохраняет черновик текущего вопроса; повторное нажатие после ошибки — повтор. */
  save(): void {
    const question = this.question();
    const number = question?.number ?? 0;
    const optionIds = [...(this.drafts().get(number) ?? [])];

    if (!question || question.answered || !optionIds.length || this.saving().has(number)) return;
    if (this.phase() !== 'running') return;

    this.saving.update((saving) => new Set(saving).add(number));
    this.clearFailure(number);
    this.jobs.next({ kind: 'answer', number, optionIds });
  }

  /** `auto` — время вышло: результат показывается как «время истекло». */
  finish(auto = false): void {
    if (this.phase() !== 'running') return;

    if (auto) this.timeUp.set(true);
    this.finishError.set(null);
    this.phase.set('finishing');
    this.jobs.next({ kind: 'finish', auto });
  }

  sync(): void {
    if (this.phase() === 'running') this.jobs.next({ kind: 'sync' });
  }

  private run(job: Job): Observable<unknown> {
    switch (job.kind) {
      case 'answer':
        return this.runAnswer(job.number, job.optionIds);
      case 'finish':
        return this.runFinish();
      case 'sync':
        if (this.phase() !== 'running') return EMPTY;

        return this.api.view(this.testId, skipErrorToast()).pipe(
          tap((view) => this.apply(view)),
          catchError(() => EMPTY),
        );
    }
  }

  private runAnswer(number: number, optionIds: number[]): Observable<unknown> {
    // Тест уже завершён (например, 4133 на предыдущем ответе) — оставшиеся ответы не отправляем.
    if (this.phase() === 'finished') {
      this.unsave(number);

      return EMPTY;
    }

    return this.api.answer(this.testId, number, optionIds, skipErrorToast()).pipe(
      retryTransient(),
      map((view) => {
        this.unsave(number);
        this.apply(view);
        if (this.current() === number) this.current.set(nextUnanswered(this.questions(), number) ?? number);
      }),
      catchError((error: unknown) => {
        this.unsave(number);

        return this.onAnswerError(number, error);
      }),
    );
  }

  private onAnswerError(number: number, error: unknown): Observable<unknown> {
    const code = apiErrorOf(error)?.errorCode;

    if (code === QUIZ_ERRORS.TIME_LIMIT) {
      // Бэкенд уже завершил тест и подсчитал результат.
      this.timeUp.set(true);

      return this.loadResult();
    }

    if (code === QUIZ_ERRORS.ALREADY_FINISHED) return this.loadResult();

    if (code === QUIZ_ERRORS.ANSWER_ALREADY_SUBMITTED) {
      // Ответ уже на сервере (например, прошлый запрос дошёл, а ответ потерялся) — берём его состояние.
      return this.api.view(this.testId, skipErrorToast()).pipe(
        tap((view) => this.apply(view)),
        catchError(() => EMPTY),
      );
    }

    this.failed.update((failed) => new Map(failed).set(number, apiErrorOf(error)?.message ?? ''));

    return EMPTY;
  }

  private runFinish(): Observable<unknown> {
    // Тест уже завершил предыдущий запрос из очереди (4133/4118 на ответе) — второй раз не завершаем.
    if (this.phase() === 'finished') return EMPTY;

    return this.api.finish(this.testId, skipErrorToast()).pipe(
      retryTransient(),
      tap((result) => this.done(result)),
      catchError((error: unknown) => {
        const code = apiErrorOf(error)?.errorCode;

        // Тест уже завершён фоновым процессом по времени или в другой вкладке.
        if (code === QUIZ_ERRORS.ALREADY_FINISHED) return this.loadResult();

        this.finishError.set(apiErrorOf(error)?.message ?? '');
        this.phase.set('running');

        return EMPTY;
      }),
    );
  }

  private loadResult(): Observable<unknown> {
    return this.api.result(this.testId, skipErrorToast()).pipe(
      retryTransient(),
      tap((result) => this.done(result)),
      // Результат не получили — страница результата запросит его сама.
      catchError(() => {
        this.done(null);

        return EMPTY;
      }),
    );
  }

  private done(result: TestResult | null): void {
    this.result.set(result);
    this.saving.set(new Set());
    this.phase.set('finished');
  }

  private apply(view: TestView): void {
    this.state.set(view);
    this.now.set(Date.now());
    this.deadline.set(deadlineAt(view.remainingSeconds, Date.now()));

    const answered = new Set(
      this.questions()
        .filter((item) => item.answered)
        .map((item) => item.number ?? 0),
    );

    if ([...this.drafts().keys()].some((number) => answered.has(number))) {
      this.drafts.update((drafts) => new Map([...drafts].filter(([number]) => !answered.has(number))));
    }

    if (view.finished) this.done(null);
  }

  private unsave(number: number): void {
    if (this.saving().has(number)) this.saving.update((saving) => without(saving, number));
  }

  private clearFailure(number: number): void {
    if (this.failed().has(number)) this.failed.update((failed) => without(failed, number));
  }
}
