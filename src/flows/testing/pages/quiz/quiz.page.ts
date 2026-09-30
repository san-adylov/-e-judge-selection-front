import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  type OnInit,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import { quizAccess } from '@features/quiz/quiz.logic';
import { QuizStore } from '@features/quiz/quiz.store';
import { QuizPaletteComponent } from '@features/quiz/quiz-palette.component';
import { QuizQuestionComponent } from '@features/quiz/quiz-question.component';
import { QuizTimerComponent } from '@features/quiz/quiz-timer.component';
import { homeUrl } from '@shared/auth/areas';
import { SessionService } from '@shared/auth/session.service';
import { NotifyService } from '@shared/ui/notify.service';

import { finishConfirmMessage, type QuizResultState } from './quiz-page.logic';

/**
 * `/testing/quiz/:testId` — прохождение теста по токену этапа TEST. Тест стартует при вводе кода
 * (`OtpValidationService` → `TestSessionService.startOrResume`), поэтому отдельного «Начать» нет:
 * сразу вопросы, таймер и сохранённые ответы (возобновление после перезагрузки — `GET /tests/{id}`).
 */
@Component({
  selector: 'app-quiz-page',
  imports: [
    LangPipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Message,
    Skeleton,
    QuizPaletteComponent,
    QuizQuestionComponent,
    QuizTimerComponent,
  ],
  providers: [QuizStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz.page.html',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export default class QuizPage implements OnInit {
  protected readonly store = inject(QuizStore);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** Параметр маршрута `:testId` — `exerciseId` из токена этапа. */
  readonly testId = input.required<string>();

  private id = 0;
  /** Сетка вопросов на узких экранах свёрнута; от 1400 px она всегда видна справа. */
  protected readonly paletteOpen = signal(false);
  protected readonly rulesOpen = signal(true);

  protected readonly locked = computed(() => this.store.phase() !== 'running' || this.store.secondsLeft() === 0);
  protected readonly progress = computed(() => {
    const total = this.store.total();

    return total ? Math.round((this.store.answeredCount() / total) * 100) : 0;
  });
  protected readonly allAnswered = computed(() => this.store.total() > 0 && this.store.unanswered().length === 0);

  constructor() {
    effect(() => {
      if (this.store.phase() !== 'finished') return;

      // Результат уже получен от `finish` — передаём его, чтобы не запрашивать второй раз.
      untracked(() => {
        const state: QuizResultState = {
          quizResult: this.store.result(),
          timeUp: this.store.timeUp(),
          testId: this.id,
        };

        void this.router.navigate(['/testing/quiz', this.id, 'result'], { replaceUrl: true, state });
      });
    });
  }

  ngOnInit(): void {
    const access = quizAccess(this.testId(), this.session.stage());

    if (access.kind === 'redirect') {
      // Чужое упражнение бэкенд всё равно не отдаст (4318) — сразу на свой экран.
      void this.router.navigateByUrl(homeUrl(this.session.session()), { replaceUrl: true });

      return;
    }

    this.id = access.testId;
    this.store.load(this.id);
  }

  protected reload(): void {
    if (this.id) this.store.load(this.id);
  }

  protected go(number: number | null): void {
    if (number === null) return;

    this.store.go(number);
    this.paletteOpen.set(false);
    // Фокус на текст нового вопроса: экранный диктор читает его, клавиатура продолжает с вариантов.
    afterNextRender(
      () => {
        const heading = this.document.getElementById(`quiz-q-text-${number}`);

        heading?.focus({ preventScroll: true });
        heading?.closest('article')?.scrollIntoView({ block: 'nearest' });
      },
      { injector: this.injector },
    );
  }

  protected onWarn(threshold: number): void {
    this.notify.warn(this.lang.get('quiz.timer.warn-title'), this.lang.get(`quiz.timer.warn-${threshold}`));
  }

  protected askFinish(): void {
    if (this.store.phase() !== 'running') return;

    this.confirm.confirm({
      header: this.lang.get('quiz.finish.confirm-header'),
      message: finishConfirmMessage(
        { unanswered: this.store.unanswered().length, total: this.store.total(), drafts: this.store.draftCount() },
        (key, params) => this.lang.get(key, params),
      ),
      icon: 'pi pi-flag',
      acceptLabel: this.lang.get('quiz.finish.accept'),
      rejectLabel: this.lang.get('quiz.finish.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.store.finish(),
    });
  }

  protected logout(): void {
    void this.session.logout();
  }

  /** Выбранные, но не сохранённые ответы пропадут при закрытии вкладки — браузер спросит подтверждение. */
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.draftCount() > 0 && this.store.phase() === 'running') event.preventDefault();
  }
}
