import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { type Observable, switchMap } from 'rxjs';

import { ContestApi } from '@domain/api/contest.api';
import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { FileLinkComponent } from '@features/files/file-link.component';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import {
  type Contest,
  createJudgeApplicationForm,
  JUDGE_APPLICATIONS_URL,
  type JudgeApplication,
  judgeApplicationActions,
  statusHintSeverity,
  toDraftRequest,
  toFormValue,
} from './judge-application.model';
import { JudgeApplicationFormComponent } from './judge-application-form.component';
import { JudgeApplicationInfoComponent } from './judge-application-info.component';
import { JudgeApplicationProgressComponent } from './judge-application-progress.component';
import { JudgeApplicationScoresComponent } from './judge-application-scores.component';

/**
 * Карточка заявки судьи: ход рассмотрения, черновик (правка и отправка секретарю), баллы, документы.
 * Документы к заявке прикладывает секретарь (`POST /{id}/files`), судья их только скачивает.
 */
@Component({
  selector: 'app-judge-application-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LangPipe,
    Button,
    Message,
    Skeleton,
    FileLinkComponent,
    StatusTagComponent,
    JudgeApplicationFormComponent,
    JudgeApplicationInfoComponent,
    JudgeApplicationProgressComponent,
    JudgeApplicationScoresComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './judge-application-page.component.html',
})
export default class JudgeApplicationPage {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly contestApi = inject(ContestApi);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly id = input.required<string>();

  protected readonly listUrl = JUDGE_APPLICATIONS_URL;
  protected readonly application = signal<JudgeApplication | null>(null);
  protected readonly contest = signal<Contest | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly form = createJudgeApplicationForm(inject(FormBuilder));

  protected readonly actions = computed(() => judgeApplicationActions(this.application()?.status));
  protected readonly hintSeverity = computed(() => statusHintSeverity(this.application()?.status));
  protected readonly busy = computed(() => this.saving() || this.submitting());

  constructor() {
    effect(() => {
      const id = Number(this.id());

      untracked(() => this.load(id));
    });
  }

  protected save(): void {
    const request = this.saveRequest();

    if (!request) return;

    this.saving.set(true);
    request.subscribe({
      next: (application) => {
        this.saving.set(false);
        this.apply(application);
        this.notify.success(this.lang.get('judge-applications.draft.saved'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected confirmSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.confirm.confirm({
      header: this.lang.get('judge-applications.submit.confirm-title'),
      message: this.lang.get('judge-applications.submit.confirm-message'),
      acceptLabel: this.lang.get('judge-applications.submit.action'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.submit(),
    });
  }

  private submit(): void {
    const id = this.application()?.id;

    if (id === undefined) return;

    // Несохранённые правки черновика сначала сохраняем: отправка меняет только статус.
    const saved = this.form.dirty ? this.saveRequest() : null;
    const request = saved ? saved.pipe(switchMap(() => this.api.submit(id))) : this.api.submit(id);

    this.submitting.set(true);
    request.subscribe({
      next: (application) => {
        this.submitting.set(false);
        this.apply(application);
        this.notify.success(this.lang.get('judge-applications.submit.success'));
      },
      error: () => this.submitting.set(false),
    });
  }

  /** Повторный `POST /judge-applications` с тем же конкурсом обновляет черновик (upsert). */
  private saveRequest(): Observable<JudgeApplication> | null {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return null;
    }

    return this.api.create(toDraftRequest(this.form.getRawValue()));
  }

  private load(id: number): void {
    this.loading.set(true);
    this.application.set(null);
    this.contest.set(null);

    this.api.myOne(id).subscribe({
      next: (application) => {
        this.loading.set(false);

        if (!application) return;

        this.apply(application);

        if (application.contestId !== undefined) {
          this.contestApi.get(application.contestId).subscribe({
            next: (contest) => this.contest.set(contest),
            error: () => undefined,
          });
        }
      },
      error: () => this.loading.set(false),
    });
  }

  private apply(application: JudgeApplication): void {
    this.application.set(application);
    this.form.reset(toFormValue(application));
  }
}
