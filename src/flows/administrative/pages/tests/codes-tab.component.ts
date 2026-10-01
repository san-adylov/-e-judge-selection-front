import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { TestsApi } from '@domain/api/tests.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { toServerDateTime } from '@shared/lib/dates';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';

type Exercise = Schemas['IssueCodesRequest']['exerciseType'];
type Application = Schemas['ApplicationResponse'];
type Contest = Schemas['ContestResponse'];
type Issued = Schemas['IssuedCodeResponse'];

/** Статус заявки, в котором кандидат ждёт этап (`OneTimeCodeService.requireAwaiting`). */
const AWAITING: Record<Exercise, Application['status']> = { TEST: 'APPROVED_AWAITING_TEST', ESSAY: 'PENDING_ESSAY' };

/**
 * Коды этапов (секретарь): конкурс → кандидаты, ожидающие тест или эссе → `POST /tests/codes/issue`.
 * Коды показываются один раз; повторная выдача заменяет код. Вместе с кодом уходит приглашение на этап.
 */
@Component({
  selector: 'app-codes-tab',
  imports: [
    FormsModule,
    LangPipe,
    ServerDateTimePipe,
    Button,
    Checkbox,
    DatePicker,
    InputText,
    Message,
    Select,
    SelectButton,
    Skeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './codes-tab.component.html',
})
export class CodesTabComponent implements OnInit {
  private readonly api = inject(TestsApi);
  private readonly contestApi = inject(ContestApi);
  private readonly applicationsApi = inject(ContestApplicationApi);
  private readonly names = inject(CandidateNamesStore);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly now = new Date();
  protected readonly contests = signal<Contest[]>([]);
  protected readonly contestId = signal<number | null>(null);
  protected readonly exercise = signal<Exercise>('TEST');
  protected readonly applications = signal<Application[]>([]);
  protected readonly loading = signal(false);
  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  protected readonly dateTime = signal<Date | null>(null);
  protected readonly address = signal('');
  protected readonly issuing = signal(false);
  protected readonly issued = signal<Issued[]>([]);

  protected readonly contestOptions = computed(() =>
    this.contests()
      .filter((contest) => contest.id !== undefined)
      .map((contest) => ({ value: contest.id as number, label: contest.name || `#${contest.id}` })),
  );
  protected readonly exerciseOptions = computed(() => {
    this.lang.currentLang();

    return (['TEST', 'ESSAY'] as const).map((value) => ({ value, label: this.lang.get(`staff-tests.codes.${value}`) }));
  });
  private readonly candidateNames = computed(() =>
    this.names.namesOf(this.applications().map((item) => item.candidateId))(),
  );
  protected readonly allSelected = computed(
    () => this.applications().length > 0 && this.applications().every((item) => this.selected().has(item.id ?? -1)),
  );

  ngOnInit(): void {
    this.contestApi
      .all({ size: 200, sort: 'createdAt,desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (result) => this.contests.set(result.content), error: () => undefined });
  }

  protected setContest(contestId: number | null): void {
    this.contestId.set(contestId ?? null);
    this.load();
  }

  protected setExercise(exercise: Exercise): void {
    this.exercise.set(exercise);
    this.load();
  }

  protected name(candidateId: number | undefined): string {
    if (candidateId === undefined) return '—';

    const name = this.candidateNames().get(candidateId);

    return name === undefined ? '…' : name || `#${candidateId}`;
  }

  protected toggle(id: number | undefined, checked: boolean): void {
    if (id === undefined) return;

    this.selected.update((ids) => {
      const next = new Set(ids);

      if (checked) next.add(id);
      else next.delete(id);

      return next;
    });
  }

  protected toggleAll(checked: boolean): void {
    this.selected.set(
      checked
        ? new Set(
            this.applications()
              .map((item) => item.id)
              .filter((id): id is number => id !== undefined),
          )
        : new Set(),
    );
  }

  protected issue(): void {
    const applicationIds = [...this.selected()];
    const dateTime = this.dateTime();

    if (!applicationIds.length) return;

    this.issuing.set(true);
    this.api
      .issueCodes({
        applicationIds,
        exerciseType: this.exercise(),
        dateTime: dateTime ? toServerDateTime(dateTime) : undefined,
        address: this.address().trim() || undefined,
      })
      .subscribe({
        next: (codes) => {
          this.issuing.set(false);
          this.issued.set(codes);
          this.selected.set(new Set());
          this.notify.success(this.lang.get('staff-tests.codes.success', { count: codes.length }));
        },
        error: () => this.issuing.set(false),
      });
  }

  protected copy(): void {
    const text = this.issued()
      .map((code) => `${this.name(this.candidateOf(code.applicationId))}\t${code.code}`)
      .join('\n');

    void navigator.clipboard?.writeText(text).then(() => this.notify.info(this.lang.get('staff-tests.codes.copied')));
  }

  protected candidateOf(applicationId: number | undefined): number | undefined {
    return this.applications().find((item) => item.id === applicationId)?.candidateId;
  }

  private load(): void {
    const contestId = this.contestId();
    const status = AWAITING[this.exercise()];

    this.selected.set(new Set());
    this.issued.set([]);

    if (contestId === null || !status) {
      this.applications.set([]);

      return;
    }

    this.loading.set(true);
    this.applicationsApi
      .byContest(contestId, [status], { size: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.applications.set(result.content);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
