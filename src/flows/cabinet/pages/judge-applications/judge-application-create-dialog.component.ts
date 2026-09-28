import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import { ContestApi } from '@domain/api/contest.api';
import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { backendLangOf } from '@shared/lib/language';

import {
  availableContests,
  type ContestCard,
  createJudgeApplicationForm,
  type JudgeApplication,
  type PreferredLanguage,
  toDraftRequest,
} from './judge-application.model';
import { JudgeApplicationFormComponent } from './judge-application-form.component';

/** Сколько конкурсов запрашиваем для выбора: открытых одновременно единицы. */
const CONTESTS_PAGE_SIZE = 100;

/** Новая заявка: выбор конкурса с открытым приёмом документов и контакты → `POST /judge-applications`. */
@Component({
  selector: 'app-judge-application-create-dialog',
  imports: [ReactiveFormsModule, LangPipe, Button, Dialog, Message, Skeleton, JudgeApplicationFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-2xl mx-4"
      [modal]="true"
      [draggable]="false"
      [header]="'judge-applications.create.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      @if (loading()) {
        <div class="flex flex-col gap-3">
          <p-skeleton height="2.5rem" />
          <p-skeleton height="2.5rem" />
          <p-skeleton height="5rem" />
        </div>
      } @else if (!contests().length) {
        <p-message severity="info" [text]="'judge-applications.create.no-contests' | lang" />
      } @else {
        <form class="flex flex-col gap-5" [formGroup]="form" (ngSubmit)="save()">
          <app-judge-application-form [form]="form" [contests]="contests()" />

          <div class="flex flex-wrap justify-end gap-2">
            <p-button
              severity="secondary"
              [outlined]="true"
              [label]="'shell.actions.cancel' | lang"
              (onClick)="visible.set(false)"
            />
            <p-button type="submit" [label]="'judge-applications.create.submit' | lang" [loading]="saving()" />
          </div>
        </form>
      }
    </p-dialog>
  `,
})
export class JudgeApplicationCreateDialogComponent {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly contestApi = inject(ContestApi);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  /** Уже поданные заявки: на эти конкурсы новую не создаём. */
  readonly applications = input<JudgeApplication[]>([]);
  readonly created = output<JudgeApplication>();

  protected readonly form = createJudgeApplicationForm(inject(FormBuilder));
  protected readonly contests = signal<ContestCard[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.open());
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    this.api.create(toDraftRequest(this.form.getRawValue())).subscribe({
      next: (application) => {
        this.saving.set(false);
        this.visible.set(false);
        this.created.emit(application);
      },
      error: () => this.saving.set(false),
    });
  }

  private open(): void {
    const language: PreferredLanguage = backendLangOf(this.lang.currentLang());

    this.form.reset({ contestId: null, preferredLanguage: language });
    this.loading.set(true);
    this.contestApi.available({ size: CONTESTS_PAGE_SIZE }).subscribe({
      next: (page) => {
        this.contests.set(availableContests(page.content, this.applications()));
        this.loading.set(false);
      },
      error: () => {
        this.contests.set([]);
        this.loading.set(false);
      },
    });
  }
}
