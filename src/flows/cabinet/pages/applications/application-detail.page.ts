import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { catchError, filter, forkJoin, type Observable, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { applicationActions, documentComplaintDeadline } from '@features/application-status/application-actions';
import { ApplicationHistoryComponent } from '@features/application-status/application-history.component';
import { skipErrorToast } from '@shared/api/http-context';
import { SseService } from '@shared/api/sse.service';
import { toLocalDate } from '@shared/lib/dates';
import { LocalDatePipe, ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

type Application = Schemas['ApplicationResponse'];
type History = Schemas['ApplicationStatusHistoryResponse'];

const CONTACT_FIELDS = [
  { key: 'email', label: 'email' },
  { key: 'homePhone', label: 'home-phone' },
  { key: 'workPhone', label: 'work-phone' },
  { key: 'homeAddress', label: 'home-address' },
  { key: 'contactInfo', label: 'contact-info' },
] as const satisfies readonly { key: keyof Application; label: string }[];

/** Заявка кандидата: сводка, даты этапов, история статусов и действия по статусу (`/cabinet/applications/:id`). */
@Component({
  selector: 'app-application-detail-page',
  imports: [
    RouterLink,
    LangPipe,
    Button,
    Message,
    Skeleton,
    LocalDatePipe,
    ServerDateTimePipe,
    PageHeaderComponent,
    StatusTagComponent,
    ApplicationHistoryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './application-detail.page.html',
})
export default class ApplicationDetailPage {
  private readonly api = inject(ContestApplicationApi);
  private readonly sse = inject(SseService);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly application = signal<Application | null>(null);
  protected readonly history = signal<History[]>([]);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);

  protected readonly actions = computed(() => applicationActions(this.application()?.status));
  protected readonly complaintDeadline = computed(() => {
    if (this.actions().complaint !== 'DOCUMENT_STAGE') return null;

    const deadline = documentComplaintDeadline(this.history());

    return deadline ? toLocalDate(deadline) : null;
  });
  protected readonly complaintQuery = computed(() => ({
    applicationId: this.application()?.id,
    type: this.actions().complaint,
  }));
  protected readonly contactFields = CONTACT_FIELDS;
  /** Вход на этап — отдельная страница без сессии кабинета, поэтому адрес показываем текстом. */
  protected readonly stageSignInUrl = `${inject(DOCUMENT).location.origin}/testing/sign-in`;

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => this.load(id, true));
    });

    this.sse
      .on('applicationStatus')
      .pipe(
        filter(({ applicationId }) => String(applicationId) === this.id()),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.load(this.id(), false));
  }

  protected sendForReview(): void {
    const id = this.application()?.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('applications.confirm.submit-title'),
      message: this.lang.get('applications.confirm.submit-message'),
      icon: 'pi pi-send',
      acceptLabel: this.lang.get('applications.confirm.submit-accept'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.run(this.api.sendForReview(id), 'applications.toast.submitted'),
    });
  }

  protected withdraw(): void {
    const id = this.application()?.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('applications.confirm.withdraw-title'),
      message: this.lang.get('applications.confirm.withdraw-message'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.lang.get('applications.confirm.withdraw-accept'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.run(this.api.withdraw(id), 'applications.toast.withdrawn'),
    });
  }

  private run(request: Observable<Application>, successKey: string): void {
    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success(this.lang.get(successKey));
        this.load(this.id(), false);
      },
      error: () => this.busy.set(false),
    });
  }

  /** `initial` — показать скелетон; перезапрос после действия или события SSE идёт без него. */
  private load(rawId: string, initial: boolean): void {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      this.notFound.set(true);
      this.loading.set(false);

      return;
    }

    if (initial) {
      this.loading.set(true);
      this.application.set(null);
      this.history.set([]);
    }

    forkJoin({
      // Первую загрузку (403/404) показываем на странице, а не тостом.
      application: this.api.get(id, initial ? skipErrorToast() : undefined),
      // Без истории страница остаётся рабочей.
      history: this.api.history(id).pipe(catchError(() => of<History[]>([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ application, history }) => {
          this.application.set(application);
          this.history.set(history);
          this.notFound.set(false);
          this.loading.set(false);
        },
        error: () => {
          if (initial) this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }
}
