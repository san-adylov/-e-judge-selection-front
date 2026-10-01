import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { catchError, EMPTY, forkJoin, map, type Observable, of, Subject, switchMap } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { ContestResultsApi } from '@domain/api/contest-results.api';
import { MeetingsApi } from '@domain/api/meetings.api';
import { QuestionsApi } from '@domain/api/questions.api';
import { ContestRequirementsComponent } from '@features/contest-info/contest-requirements.component';
import { ContestScheduleComponent } from '@features/contest-info/contest-schedule.component';
import { FileLinkComponent } from '@features/files/file-link.component';
import { skipErrorToast } from '@shared/api/http-context';
import { AccessDirective } from '@shared/auth/access.directive';
import { SessionService } from '@shared/auth/session.service';
import { LocalDatePipe, ServerDateTimePipe } from '@shared/lib/format.pipes';
import { localized } from '@shared/lib/language';
import { SafeHtmlPipe } from '@shared/lib/safe-html.pipe';
import { textToHtml } from '@shared/lib/text';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import {
  canCancel,
  canEdit,
  canPublish,
  type Contest,
  CONTESTS_URL,
  isPendingMeeting,
  missingForPublication,
  nextStageMeeting,
} from './contest-rules';

type Step = Schemas['ContestStepResponse'];
type Meeting = Schemas['MeetingResponse'];
type Category = Schemas['QuestionCategoryResponse'];
type Readiness = Schemas['ReporterReadinessResponse'];
type Completion = Schemas['CompletionReadinessResponse'];

interface Loaded {
  contest: Contest | null;
  missing: boolean;
  plan: Step[] | null;
  meetings: Meeting[] | null;
  categories: Category[] | null;
}

const TEXTS = [
  { key: 'description', field: 'description' },
  { key: 'note', field: 'note' },
  { key: 'additional-info', field: 'additionalInfo' },
] as const satisfies readonly { key: string; field: keyof Contest }[];

/**
 * Карточка конкурса для сотрудников (`/administrative/contests/:id`): данные, план, заседания этапов и действия
 * по роли — редактирование и публикация (SECRETARY), отмена (CHAIRMAN). Статус двигают заседания
 * (`ContestStateMachine`), поэтому карточка подсказывает, какое заседание назначить следующим.
 */
@Component({
  selector: 'app-staff-contest-detail-page',
  imports: [
    RouterLink,
    LangPipe,
    LocalDatePipe,
    ServerDateTimePipe,
    SafeHtmlPipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Message,
    Skeleton,
    AccessDirective,
    StatusTagComponent,
    FileLinkComponent,
    ContestRequirementsComponent,
    ContestScheduleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contest-detail.page.html',
})
export default class StaffContestDetailPage {
  private readonly contestApi = inject(ContestApi);
  private readonly meetingsApi = inject(MeetingsApi);
  private readonly questionsApi = inject(QuestionsApi);
  private readonly applicationsApi = inject(ContestApplicationApi);
  private readonly resultsApi = inject(ContestResultsApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly requests = new Subject<number | null>();

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly baseUrl = CONTESTS_URL;
  protected readonly contest = signal<Contest | null>(null);
  protected readonly plan = signal<Step[]>([]);
  protected readonly meetings = signal<Meeting[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly readiness = signal<Readiness | null>(null);
  protected readonly completion = signal<Completion | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly failed = signal(false);
  protected readonly acting = signal(false);

  protected readonly contestId = computed(() => this.contest()?.id ?? null);
  protected readonly status = computed(() => this.contest()?.status);
  protected readonly editable = computed(() => canEdit(this.status()));
  protected readonly publishable = computed(() => canPublish(this.status()));
  protected readonly cancellable = computed(() => canCancel(this.status()));
  protected readonly nextMeeting = computed(() => nextStageMeeting(this.status()));
  protected readonly pending = computed(() => isPendingMeeting(this.status()));
  /** Без этих полей `POST /publish` ответит ошибкой — показываем список заранее. */
  protected readonly missing = computed(() => {
    const contest = this.contest();

    return contest ? missingForPublication(contest) : [];
  });

  protected readonly texts = computed(() => {
    const contest = this.contest();

    return TEXTS.map(({ key, field }) => ({ key, html: textToHtml(contest?.[field]) })).filter((text) => !!text.html);
  });

  /** Квоты вопросов теста с названиями категорий. */
  protected readonly quotas = computed(() => {
    const lang = this.lang.currentLang();
    const names = new Map(this.categories().map((item) => [item.id, localized(item.nameRu, item.nameKg, lang)]));

    return (this.contest()?.questionCategories ?? []).map((quota) => ({
      id: quota.categoryId,
      name: names.get(quota.categoryId) || `#${quota.categoryId}`,
      count: quota.questionCount ?? 0,
    }));
  });
  protected readonly questionTotal = computed(() => this.quotas().reduce((sum, quota) => sum + quota.count, 0));

  /** Заседания этапов конкурса, новые сверху. */
  protected readonly sortedMeetings = computed(() =>
    [...this.meetings()].sort((a, b) => (b.startDateTime ?? '').localeCompare(a.startDateTime ?? '')),
  );

  constructor() {
    this.requests
      .pipe(
        switchMap((id) => (id === null ? EMPTY : this.fetch(id).pipe(map((loaded) => ({ id, loaded }))))),
        takeUntilDestroyed(),
      )
      .subscribe(({ id, loaded }) => this.show(id, loaded));

    effect(() => {
      const id = this.id();

      untracked(() => this.load(id));
    });
  }

  protected retry(): void {
    this.load(this.id());
  }

  protected publish(): void {
    const id = this.contestId();

    if (id === null) return;

    this.confirm.confirm({
      header: this.lang.get('staff-contests.publish.confirm-title'),
      message: this.lang.get('staff-contests.publish.confirm-message'),
      icon: 'pi pi-megaphone',
      acceptLabel: this.lang.get('staff-contests.actions.publish'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.run(this.contestApi.publish(id), 'staff-contests.publish.success'),
    });
  }

  protected cancel(): void {
    const id = this.contestId();

    if (id === null) return;

    this.confirm.confirm({
      header: this.lang.get('staff-contests.cancel.confirm-title'),
      message: this.lang.get('staff-contests.cancel.confirm-message'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.lang.get('staff-contests.actions.cancel'),
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.run(this.contestApi.cancel(id), 'staff-contests.cancel.success'),
    });
  }

  /** Экран заседаний открывает форму назначения с предзаполненными конкурсом и типом (query-параметры). */
  protected goToMeetings(): void {
    const id = this.contestId();
    const type = this.nextMeeting();

    if (id === null || !type) return;

    void this.router.navigate(['/administrative/meetings'], { queryParams: { contestId: id, type } });
  }

  private run(request: Observable<Contest>, successKey: string): void {
    this.acting.set(true);
    request.subscribe({
      next: (contest) => {
        this.acting.set(false);
        this.contest.set(contest);
        this.notify.success(this.lang.get(successKey));
        this.loadExtras(contest);
      },
      error: () => this.acting.set(false),
    });
  }

  private load(rawId: string): void {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      this.requests.next(null);
      this.notFound.set(true);
      this.failed.set(false);
      this.loading.set(false);

      return;
    }

    this.loading.set(true);
    this.requests.next(id);
  }

  private fetch(id: number): Observable<Loaded> {
    return forkJoin({
      contest: this.contestApi.get(id, skipErrorToast()).pipe(
        map((contest) => ({ contest, missing: false })),
        catchError((error: unknown) =>
          of({ contest: null, missing: error instanceof HttpErrorResponse && error.status === 404 }),
        ),
      ),
      plan: this.contestApi.steps(id, skipErrorToast()).pipe(catchError(() => of(null))),
      meetings: this.meetingsApi.byContest(id, { size: 100 }).pipe(
        map((page) => page.content),
        catchError(() => of(null)),
      ),
      categories: this.questionsApi.categories().pipe(catchError(() => of(null))),
    }).pipe(map(({ contest, ...rest }) => ({ ...contest, ...rest })));
  }

  private show(id: number, { contest, missing, plan, meetings, categories }: Loaded): void {
    if (Number(this.id()) !== id) return;

    this.contest.set(contest);
    this.plan.set(plan ?? contest?.steps ?? []);
    this.meetings.set(meetings ?? []);
    this.categories.set(categories ?? []);
    this.notFound.set(!contest && missing);
    this.failed.set(!contest && !missing);
    this.loading.set(false);

    if (contest) this.loadExtras(contest);
  }

  /** Готовность докладчиков (Совет) и готовность к закрытию (председатель) — только когда они по делу. */
  private loadExtras(contest: Contest): void {
    const id = contest.id;

    this.readiness.set(null);
    this.completion.set(null);

    if (id === undefined) return;

    const reviewStage = contest.status === 'PUBLISHED' || contest.status === 'PENDING_DOCUMENT_REVIEW';
    const closingStage = contest.status === 'INTERVIEW_COMPLETED' || contest.status === 'PENDING_CLOSURE';

    if (reviewStage && this.session.can('COUNCIL')) {
      this.applicationsApi
        .readiness(id)
        .pipe(catchError(() => of(null)))
        .subscribe((readiness) => this.readiness.set(readiness));
    }

    if (closingStage && this.session.can('CHAIRMAN')) {
      this.resultsApi
        .readiness(id)
        .pipe(catchError(() => of(null)))
        .subscribe((completion) => this.completion.set(completion));
    }
  }
}
