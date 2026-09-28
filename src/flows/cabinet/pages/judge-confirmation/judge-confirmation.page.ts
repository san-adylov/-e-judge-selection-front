import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { catchError, filter, forkJoin, of, throwError } from 'rxjs';

import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { apiErrorOf } from '@shared/api/api-error';
import { skipErrorToast } from '@shared/api/http-context';
import { SseService } from '@shared/api/sse.service';
import { SessionService } from '@shared/auth/session.service';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { ConfirmationFormComponent } from './confirmation-form.component';
import { ConfirmationHistoryComponent } from './confirmation-history.component';
import { ConfirmationStatusComponent } from './confirmation-status.component';
import { type Confirmation, confirmationActions, confirmationView } from './judge-confirmation.logic';

/**
 * Подтверждение статуса действующего судьи (`/cabinet/judge-confirmation`, спека 17.1).
 * В v1 это была роль JUDGE_PENDING_APPROVAL; в v2 состояние — статус последней заявки (`GET /my/latest`),
 * роль кандидата сохраняется, одобрение добавляет ACTIVE_JUDGE.
 */
@Component({
  selector: 'app-judge-confirmation-page',
  imports: [
    LangPipe,
    Button,
    Message,
    Skeleton,
    PageHeaderComponent,
    ConfirmationFormComponent,
    ConfirmationHistoryComponent,
    ConfirmationStatusComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="judge-confirmation.title" subtitle="judge-confirmation.subtitle" />

    <div class="flex max-w-5xl flex-col gap-4">
      @if (!loaded()) {
        @if (loadError(); as error) {
          <p-message severity="error">
            <div class="flex flex-wrap items-center gap-3">
              <span>{{ error }}</span>
              <p-button
                icon="pi pi-refresh"
                size="small"
                severity="secondary"
                [outlined]="true"
                [label]="'judge-confirmation.retry' | lang"
                (onClick)="load()"
              />
            </div>
          </p-message>
        } @else {
          <section class="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
            <p-skeleton width="40%" height="1.5rem" />
            <p-skeleton height="8rem" />
          </section>
        }
      } @else {
        @if (view() === 'intro') {
          <section class="rounded-xl border border-primary-100 bg-primary-50 p-4 tablet:p-5">
            <h2 class="m-0 text-lg font-semibold text-primary-800">{{ 'judge-confirmation.intro.title' | lang }}</h2>
            <p class="m-0 mt-2 text-sm">{{ 'judge-confirmation.intro.text' | lang }}</p>
            <ol class="m-0 mt-3 flex flex-col gap-1 pl-5 text-sm">
              @for (step of steps; track step) {
                <li>{{ step | lang }}</li>
              }
            </ol>
            <p class="m-0 mt-3 text-sm text-surface-600">{{ 'judge-confirmation.intro.roles' | lang }}</p>
            @if (isJudge()) {
              <p-message
                severity="success"
                styleClass="mt-3"
                [text]="'judge-confirmation.intro.already-judge' | lang"
              />
            }
          </section>
        }

        @if (latest(); as current) {
          @if (!actions().edit) {
            <app-judge-confirmation-status
              [confirmation]="current"
              [view]="view()"
              [canStartNew]="actions().startNew && !startingNew()"
              (startNew)="startingNew.set(true)"
            />
          }
        }

        @if (actions().edit || startingNew()) {
          <app-judge-confirmation-form
            [source]="latest()"
            [cancellable]="startingNew()"
            (changed)="onChanged()"
            (cancelled)="startingNew.set(false)"
          />
        }

        @if (history().length) {
          <app-judge-confirmation-history [items]="history()" />
        }
      }
    </div>
  `,
})
export default class JudgeConfirmationPage {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly lang = inject(LangService);
  private readonly session = inject(SessionService);

  protected readonly latest = signal<Confirmation | null>(null);
  protected readonly history = signal<Confirmation[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal<string | null>(null);
  /** Новая заявка после решения (APPROVED / REJECTED) — форма поверх карточки решения. */
  protected readonly startingNew = signal(false);
  protected readonly view = computed(() => confirmationView(this.latest()));
  protected readonly actions = computed(() => confirmationActions(this.view()));
  protected readonly isJudge = computed(() => this.session.can('ACTIVE_JUDGE'));
  protected readonly steps = [
    'judge-confirmation.intro.step-fill',
    'judge-confirmation.intro.step-submit',
    'judge-confirmation.intro.step-review',
    'judge-confirmation.intro.step-result',
  ];

  constructor() {
    // Решение секретаря приходит уведомлением JUDGE_STATUS_CHANGED — перечитываем заявку.
    inject(SseService)
      .on('notification')
      .pipe(
        filter((event) => event.type === 'JUDGE_STATUS_CHANGED'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.load());
    this.load();
  }

  protected load(): void {
    this.loadError.set(null);
    forkJoin({
      // 404 (44430) — заявок ещё не было: показываем пояснение и форму.
      latest: this.api
        .myLatestConfirmation(skipErrorToast())
        .pipe(
          catchError((error: unknown) =>
            error instanceof HttpErrorResponse && error.status === 404 ? of(null) : throwError(() => error),
          ),
        ),
      history: this.api.myConfirmationHistory(),
    }).subscribe({
      next: ({ latest, history }) => {
        this.latest.set(latest);
        this.history.set(history);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        if (!this.loaded()) {
          this.loadError.set(apiErrorOf(error)?.message ?? this.lang.get('judge-confirmation.load-error'));
        }
      },
    });
  }

  protected onChanged(): void {
    this.startingNew.set(false);
    this.load();
  }
}
