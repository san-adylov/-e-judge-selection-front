import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import { catchError, concat, EMPTY, forkJoin, last, map, type Observable, of, Subject, switchMap } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { QuestionsApi } from '@domain/api/questions.api';
import { DirectoryStore } from '@domain/stores/directory.store';
import { FileUploadComponent } from '@features/files/file-upload.component';
import { skipErrorToast } from '@shared/api/http-context';
import { localized } from '@shared/lib/language';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

import {
  CONTEST_TYPES,
  type ContestFormValue,
  contestToForm,
  createContestForm,
  invalidSteps,
  NAME_MAX,
  type QuotaDraft,
  quotasFromContest,
  STAGES,
  type StepDraft,
  stepsChanged,
  stepsFromPlan,
  TEXT_MAX,
  toDetailsRequest,
  toStepRequests,
} from './contest-form';
import { canEdit, type Contest, CONTESTS_URL } from './contest-rules';

type Category = Schemas['QuestionCategoryResponse'];

interface Loaded {
  contest: Contest | null;
  missing: boolean;
  plan: Schemas['ContestStepResponse'][] | null;
  categories: Category[] | null;
}

/**
 * Редактирование конкурса секретарём (`/administrative/contests/:id/edit`): название (`PATCH /update-name`),
 * детали одним запросом (`PATCH /contest/{id}` — заменяет всё), календарный план (`PUT /contest/steps/{id}`).
 * Доступно до конечного статуса; после публикации тоже — бэкенд ограничивает только конечные состояния.
 */
@Component({
  selector: 'app-staff-contest-edit-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    LangPipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    DatePicker,
    InputNumber,
    InputText,
    Message,
    MultiSelect,
    Select,
    Skeleton,
    Textarea,
    FileUploadComponent,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contest-edit.page.html',
})
export default class StaffContestEditPage {
  private readonly api = inject(ContestApi);
  private readonly questionsApi = inject(QuestionsApi);
  private readonly directories = inject(DirectoryStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly requests = new Subject<number | null>();

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly baseUrl = CONTESTS_URL;
  protected readonly nameMax = NAME_MAX;
  protected readonly textMax = TEXT_MAX;
  protected readonly stages = STAGES;
  protected readonly form = createContestForm(inject(FormBuilder));

  protected readonly contest = signal<Contest | null>(null);
  protected readonly steps = signal<StepDraft[]>([]);
  protected readonly quotas = signal<QuotaDraft[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  /** Шаги плана с окончанием раньше начала — сохранять нельзя. */
  protected readonly stepErrors = computed(() => new Set(invalidSteps(this.steps())));

  private initialSteps: StepDraft[] = [];
  private initialName = '';

  protected readonly readonlyStatus = computed(() => {
    const contest = this.contest();

    return !!contest && !canEdit(contest.status);
  });

  protected readonly typeOptions = computed(() => {
    this.lang.currentLang();

    return CONTEST_TYPES.map((value) => ({ value, label: this.lang.get(`status.contestType.${value}`) }));
  });
  protected readonly courtInstances = this.directories.options('COURT_INSTANCE');
  protected readonly ageRequirements = this.directories.options('AGE_REQUIREMENT');
  protected readonly educationRequirements = this.directories.options('EDUCATION_REQUIREMENT');
  protected readonly workExperienceRequirements = this.directories.options('WORK_EXPERIENCE_REQUIREMENT');
  protected readonly citizenships = this.directories.options('CITIZENSHIP');
  protected readonly languageLevels = this.directories.options('LANGUAGE_LEVEL');
  protected readonly documentTypes = this.directories.options('DOCUMENT_TYPE');

  /** Квоты с названиями категорий — строки таблицы «Тестирование». */
  protected readonly quotaRows = computed(() => {
    const lang = this.lang.currentLang();
    const names = new Map(this.categories().map((item) => [item.id, localized(item.nameRu, item.nameKg, lang)]));

    return this.quotas().map((quota) => ({ ...quota, name: names.get(quota.categoryId) || `#${quota.categoryId}` }));
  });
  protected readonly questionTotal = computed(() =>
    this.quotas().reduce((sum, quota) => sum + (quota.questionCount ?? 0), 0),
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

  protected setStep(type: StepDraft['type'], field: 'start' | 'end', value: Date | null): void {
    this.steps.update((steps) => steps.map((step) => (step.type === type ? { ...step, [field]: value } : step)));
  }

  protected setQuota(categoryId: number, value: number | null): void {
    this.quotas.update((quotas) =>
      quotas.map((quota) => (quota.categoryId === categoryId ? { ...quota, questionCount: value } : quota)),
    );
  }

  protected save(): void {
    const contest = this.contest();
    const id = contest?.id;

    if (!contest || id === undefined || this.saving() || this.uploading()) return;

    if (this.form.invalid || this.stepErrors().size) {
      this.form.markAllAsTouched();
      this.notify.warn(this.lang.get('staff-contests.edit.invalid'));

      return;
    }

    const value: ContestFormValue = this.form.getRawValue();
    const name = value.name.trim();
    const courtInstanceName =
      this.courtInstances().find((option) => option.value === value.courtInstanceId)?.label ?? null;
    const steps = this.steps();
    const requests: Observable<unknown>[] = [
      this.api.updateDetails(id, toDetailsRequest(value, courtInstanceName, this.quotas())),
    ];

    if (name !== this.initialName) requests.unshift(this.api.updateName(id, { name }));
    if (stepsChanged(this.initialSteps, steps)) requests.push(this.api.saveSteps(id, toStepRequests(steps)));

    this.saving.set(true);
    // Последовательно: переименование и детали, затем план; при сбое одного шага остальные не выполняются.
    concat(...requests)
      .pipe(last())
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify.success(this.lang.get('shell.form.saved'));
          void this.router.navigate([CONTESTS_URL, id]);
        },
        error: () => this.saving.set(false),
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
      contest: this.api.get(id, skipErrorToast()).pipe(
        map((contest) => ({ contest, missing: false })),
        catchError((error: unknown) =>
          of({ contest: null, missing: error instanceof HttpErrorResponse && error.status === 404 }),
        ),
      ),
      plan: this.api.steps(id, skipErrorToast()).pipe(catchError(() => of(null))),
      categories: this.questionsApi.categories().pipe(catchError(() => of(null))),
    }).pipe(map(({ contest, ...rest }) => ({ ...contest, ...rest })));
  }

  private show(id: number, { contest, missing, plan, categories }: Loaded): void {
    if (Number(this.id()) !== id) return;

    this.contest.set(contest);
    this.categories.set(categories ?? []);
    this.notFound.set(!contest && missing);
    this.failed.set(!contest && !missing);

    if (contest) {
      const value = contestToForm(contest);

      this.form.reset(value);
      this.initialName = value.name;
      this.initialSteps = stepsFromPlan(plan ?? contest.steps);
      this.steps.set(this.initialSteps.map((step) => ({ ...step })));
      this.quotas.set(quotasFromContest(contest, categories ?? []));
    }

    this.loading.set(false);
  }
}
