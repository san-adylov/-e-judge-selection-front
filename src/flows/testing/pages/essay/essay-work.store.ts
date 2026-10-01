import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { LangService } from '@reforgium/presentia';

import { EssayApi } from '@domain/api/essay.api';
import { secondsLeft, timerLevel } from '@features/stage-timer/stage-timer.logic';
import { apiErrorOf } from '@shared/api/api-error';
import { skipErrorToast } from '@shared/api/http-context';
import { localized } from '@shared/lib/language';

import {
  AUTO_SUBMIT_SECONDS,
  ESSAY_ERRORS,
  type EssayPhase,
  initialPhase,
  normalizeAnswers,
  questionsOf,
  remainingAtResponse,
  RETRY_DELAY_MS,
  type Submission,
  toReplyRequest,
} from './essay.logic';
import { DraftBackup, safeSessionStorage } from './essay-draft';

/** После скольких мс в фоне сверять срок с сервером заново (сон ноутбука, троттлинг таймеров). */
const RESYNC_AFTER_HIDDEN_MS = 60_000;

export type SubmitMode = 'manual' | 'auto';

/**
 * Состояние письменного задания одного экрана (провайдер страницы). Сервер хранит только итоговую отправку
 * (`PUT /essay/my/reply` — один раз, до срока), поэтому черновик живёт на устройстве, а за `AUTO_SUBMIT_SECONDS`
 * до срока работа отправляется сама. Таймер — по сроку сервера, а не по часам устройства.
 */
@Injectable()
export class EssayWorkStore {
  private readonly api = inject(EssayApi);
  private readonly lang = inject(LangService);
  private readonly document = inject(DOCUMENT);
  private readonly draft = new DraftBackup(safeSessionStorage(this.document.defaultView));

  private applicationId: number | undefined;
  private endsAt = 0;
  private hiddenAt: number | null = null;
  private sending = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly phase = signal<EssayPhase>('loading');
  readonly submission = signal<Submission | null>(null);
  readonly answers = signal<string[]>([]);
  readonly remaining = signal(0);
  readonly savedAt = this.draft.savedAt.asReadonly();
  readonly saveFailed = this.draft.failed.asReadonly();
  readonly loadError = signal<string | null>(null);
  /** Текст для `aria-live`: автоотправка (пороги времени объявляет сам таймер). */
  readonly announcement = signal('');
  readonly finishedBy = signal<SubmitMode | null>(null);

  readonly questions = computed(() => questionsOf(this.submission(), this.lang.currentLang()));
  readonly theme = computed(() => {
    const topic = this.submission()?.topic;

    return localized(topic?.themeRu, topic?.themeKg, this.lang.currentLang());
  });
  readonly timeLimitMinutes = computed(() => this.submission()?.topic?.timeLimitMinutes ?? null);
  readonly level = computed(() => timerLevel(this.remaining()));
  readonly readonly = computed(() => this.phase() !== 'writing');

  constructor() {
    const view = this.document.defaultView;
    const onVisibility = () => this.onVisibilityChange();
    const onPageHide = () => this.draft.flush();

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      this.draft.flush();

      if (this.phase() === 'writing' || this.phase() === 'submitting') event.preventDefault();
    };

    this.document.addEventListener('visibilitychange', onVisibility);
    view?.addEventListener('pagehide', onPageHide);
    view?.addEventListener('beforeunload', onBeforeUnload);
    inject(DestroyRef).onDestroy(() => {
      this.draft.flush();
      this.stopTimers();
      this.document.removeEventListener('visibilitychange', onVisibility);
      view?.removeEventListener('pagehide', onPageHide);
      view?.removeEventListener('beforeunload', onBeforeUnload);
    });
  }

  /** `applicationId` — только для обычного токена кандидата; с токеном этапа бэкенд берёт работу из токена. */
  load(applicationId?: number): void {
    this.applicationId = applicationId;
    this.phase.set('loading');
    this.loadError.set(null);
    this.api.myTimed(applicationId).subscribe({
      next: ({ body, serverTime }) => this.applyLoaded(body, serverTime),
      error: (error: unknown) => {
        this.loadError.set(apiErrorOf(error)?.message ?? null);
        this.phase.set('error');
      },
    });
  }

  /** Вводная → текст. Пустой черновик отмечает, что вводная пройдена: после перезагрузки — сразу к тексту. */
  start(): void {
    if (this.phase() !== 'intro') return;

    this.phase.set('writing');
    this.draft.write(this.answers());
  }

  setAnswer(index: number, value: string): void {
    if (this.phase() !== 'writing') return;

    this.answers.update((answers) => answers.map((answer, i) => (i === index ? value : answer)));
    this.draft.schedule(() => this.answers());
  }

  /** По кнопке (после подтверждения) или автоматически у срока; пока одна отправка в пути, вторая не начнётся. */
  submit(mode: SubmitMode = 'manual'): void {
    if (this.sending || this.phase() !== 'writing') return;

    this.draft.flush();
    this.send(mode);
  }

  /** Перед выходом: черновик на устройстве больше не нужен, следующий кандидат его не увидит. */
  discardDraft(): void {
    this.draft.remove();
  }

  private send(mode: SubmitMode): void {
    this.sending = true;
    this.phase.set('submitting');

    const body = toReplyRequest(this.answers(), this.questions().length);

    this.api.reply(body, this.applicationId, mode === 'auto' ? skipErrorToast() : undefined).subscribe({
      next: (submission) => this.finish(submission, mode),
      error: (error: unknown) => this.onSendError(error, mode),
    });
  }

  private finish(submission: Submission, mode: SubmitMode): void {
    this.sending = false;
    this.stopTimers();
    this.submission.set(submission);
    this.answers.set(normalizeAnswers(submission.answers ?? this.answers(), this.questions().length));
    this.remaining.set(0);
    this.finishedBy.set(mode);
    this.draft.remove();
    this.phase.set('done');
  }

  private onSendError(error: unknown, mode: SubmitMode): void {
    this.sending = false;

    const code = apiErrorOf(error)?.errorCode;

    if (code === ESSAY_ERRORS.ALREADY_SUBMITTED) {
      // Уже отправлено (другая вкладка или потерянный ответ) — показываем то, что на сервере.
      this.stopTimers();
      this.load(this.applicationId);

      return;
    }

    if (code === ESSAY_ERRORS.TIME_LIMIT || secondsLeft(this.endsAt, Date.now()) <= 0) {
      this.expire();

      return;
    }

    const transient = error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);

    if (mode === 'auto' && transient) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.send('auto');
      }, RETRY_DELAY_MS);

      return;
    }

    // Ручная отправка не прошла — продолжаем писать, причину показал тост интерсептора.
    // Если до срока меньше AUTO_SUBMIT_SECONDS, следующий отсчёт отправит работу сам.
    this.phase.set('writing');
  }

  private applyLoaded(submission: Submission, serverTime: number | null): void {
    const remaining = remainingAtResponse(submission, serverTime, Date.now());
    const count = questionsOf(submission, 'ru').length;
    const draft = submission.id === undefined ? null : this.draft.open(submission.id);

    this.submission.set(submission);
    this.endsAt = Date.now() + remaining * 1000;
    this.remaining.set(remaining);
    this.answers.set(normalizeAnswers(submission.submitted ? submission.answers : draft?.answers, count));

    const phase = initialPhase(submission, remaining, draft !== null);

    this.phase.set(phase);

    if (phase === 'done') this.draft.remove();
    if (phase === 'intro' || phase === 'writing') this.startTicking();
  }

  /** Сверка срока с сервером; текст на устройстве не трогаем. */
  private resync(): void {
    this.api.myTimed(this.applicationId).subscribe({
      next: ({ body, serverTime }) => {
        if (body.submitted) {
          this.finish(body, 'manual');

          return;
        }

        this.endsAt = Date.now() + remainingAtResponse(body, serverTime, Date.now()) * 1000;
        this.tick();
      },
      error: () => undefined,
    });
  }

  private startTicking(): void {
    this.stopTimers();
    this.tickTimer = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  private tick(): void {
    const current = secondsLeft(this.endsAt, Date.now());
    const phase = this.phase();

    this.remaining.set(current);

    if (phase !== 'intro' && phase !== 'writing') return;

    if (phase === 'writing' && current <= AUTO_SUBMIT_SECONDS) {
      this.announcement.set(this.lang.get('essay.timer.auto-submit'));
      this.submit('auto');
    } else if (current <= 0) {
      this.expire();
    }
  }

  private expire(): void {
    this.stopTimers();
    this.remaining.set(0);
    this.phase.set('expired');
  }

  private onVisibilityChange(): void {
    if (this.document.visibilityState === 'hidden') {
      this.hiddenAt = Date.now();
      this.draft.flush();

      return;
    }

    const hiddenFor = this.hiddenAt === null ? 0 : Date.now() - this.hiddenAt;

    this.hiddenAt = null;

    if (this.phase() !== 'intro' && this.phase() !== 'writing') return;

    this.tick();

    if (hiddenFor >= RESYNC_AFTER_HIDDEN_MS) this.resync();
  }

  private stopTimers(): void {
    if (this.tickTimer !== null) clearInterval(this.tickTimer);
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.tickTimer = null;
    this.retryTimer = null;
  }
}
