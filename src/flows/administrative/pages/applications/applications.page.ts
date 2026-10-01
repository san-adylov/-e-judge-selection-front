import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  type TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { GridColumns, RenderTemplateData } from '@reforgium/data-grid';
import { LangPipe, LangService } from '@reforgium/presentia';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { catchError, map, type Observable, of } from 'rxjs';

import type { ApplicationStatus, Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { DataTableComponent, type TablePage } from '@shared/ui/data-table/data-table.component';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { type Application, APPLICATION_STATUSES, APPLICATIONS_URL, DEFAULT_STATUSES } from './application-rules';

type Mode = 'all' | 'mine';
type Contest = Schemas['ContestResponse'];

const PAGE_SIZE = 20;

/**
 * Заявки конкурса для Совета (`/administrative/applications?contestId=&mode=`): все заявки по статусам
 * (`GET /contest-application/by-contest/{id}?status`) или «мои доклады» члена Совета (`GET /my-reporting`).
 * Действия — на карточке заявки. Имена кандидатов подгружаются из профилей, докладчиков — из сводки готовности.
 */
@Component({
  selector: 'app-staff-applications-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    MultiSelect,
    Select,
    SelectButton,
    DataTableComponent,
    PageHeaderComponent,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './applications.page.html',
})
export default class StaffApplicationsPage {
  private readonly api = inject(ContestApplicationApi);
  private readonly contestApi = inject(ContestApi);
  private readonly names = inject(CandidateNamesStore);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateTime = new ServerDateTimePipe();

  private readonly candidateCell = viewChild.required<TemplateRef<RenderTemplateData<Application>>>('candidateCell');
  private readonly statusCell = viewChild.required<TemplateRef<RenderTemplateData<Application>>>('statusCell');
  private readonly reporterCell = viewChild.required<TemplateRef<RenderTemplateData<Application>>>('reporterCell');

  /** Query-параметры (`withComponentInputBinding`): конкурс и режим приходят из адреса и возвращаются в него. */
  readonly contestId = input<string | undefined>();
  readonly mode = input<string | undefined>();

  protected readonly baseUrl = APPLICATIONS_URL;
  protected readonly canReport = computed(() => this.session.can('BOARD'));
  protected readonly selectedContestId = signal<number | null>(null);
  protected readonly selectedMode = signal<Mode>('all');
  protected readonly statuses = signal<ApplicationStatus[]>([...DEFAULT_STATUSES]);
  protected readonly contests = signal<Contest[]>([]);
  protected readonly contestsLoading = signal(true);
  protected readonly rows = signal<Application[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(PAGE_SIZE);
  private readonly reporters = signal<ReadonlyMap<number, string>>(new Map());
  private readonly candidateNames = computed(() => this.names.namesOf(this.rows().map((row) => row.candidateId))());

  protected readonly contestOptions = computed(() =>
    this.contests()
      .filter((contest) => contest.id !== undefined)
      .map((contest) => ({ value: contest.id as number, label: contest.name || `#${contest.id}` })),
  );
  protected readonly modeOptions = computed(() => {
    this.lang.currentLang();

    return (['all', 'mine'] as const).map((value) => ({
      value,
      label: this.lang.get(`staff-applications.mode.${value}`),
    }));
  });
  private readonly statusLabels = APPLICATION_STATUSES.map((value) => ({
    value,
    label: this.lang.observe(`status.application.${value}`),
  }));
  protected readonly statusOptions = computed(() =>
    this.statusLabels.map(({ value, label }) => ({ value, label: label() })),
  );

  /** «Мои доклады» приходят списком без страниц — режем на клиенте теми же размерами. */
  protected readonly pageRows = computed(() => {
    if (this.selectedMode() === 'all') return this.rows();

    const start = this.page() * this.size();

    return this.rows().slice(start, start + this.size());
  });

  protected readonly columns = computed<GridColumns<Application>>(() => {
    this.lang.currentLang();

    const header = (key: string) => this.lang.get(`staff-applications.columns.${key}`);
    const track = (row: Application) => String(row.id);

    return [
      {
        key: 'candidateId',
        header: header('candidate'),
        flex: 2,
        minWidth: 220,
        track,
        renderTemplate: this.candidateCell(),
      },
      {
        key: 'registrationNumber',
        header: header('registration-number'),
        minWidth: 150,
        track,
        value: (row) => row.registrationNumber || '—',
      },
      { key: 'status', header: header('status'), minWidth: 230, track, renderTemplate: this.statusCell() },
      { key: 'reporterId', header: header('reporter'), minWidth: 200, track, renderTemplate: this.reporterCell() },
      {
        key: 'createdAt',
        header: header('created-at'),
        minWidth: 150,
        track,
        value: (row) => this.dateTime.transform(row.createdAt),
      },
    ];
  });

  constructor() {
    this.contestApi
      .all({ size: 200, sort: 'createdAt,desc' })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (result) => {
          this.contests.set(result.content);
          this.contestsLoading.set(false);
        },
        error: () => this.contestsLoading.set(false),
      });

    // Адрес — источник правды: переход с карточки конкурса и кнопка «назад» восстанавливают фильтры.
    effect(() => {
      const id = Number(this.contestId());
      const mode: Mode = this.mode() === 'mine' && this.canReport() ? 'mine' : 'all';

      untracked(() => {
        this.selectedContestId.set(Number.isInteger(id) && id > 0 ? id : null);
        this.selectedMode.set(mode);
        this.load(0);
      });
    });
  }

  protected setContest(contestId: number | null): void {
    this.navigate({ contestId, mode: this.selectedMode() });
  }

  protected setMode(mode: Mode): void {
    this.navigate({ contestId: this.selectedContestId(), mode });
  }

  protected setStatuses(statuses: ApplicationStatus[]): void {
    this.statuses.set(statuses);
    this.load(0);
  }

  protected onPage({ page, size }: TablePage): void {
    this.size.set(size);

    if (this.selectedMode() === 'mine') this.page.set(page);
    else this.load(page);
  }

  protected open(application: Application): void {
    if (application.id !== undefined) void this.router.navigate([APPLICATIONS_URL, application.id]);
  }

  /** Имя ещё грузится — многоточие; профиля нет — номер пользователя. */
  protected candidateName(candidateId: number | undefined): string {
    if (candidateId === undefined) return '—';

    const name = this.candidateNames().get(candidateId);

    return name === undefined ? '…' : name || `#${candidateId}`;
  }

  protected reporterName(reporterId: number): string {
    return this.reporters().get(reporterId) || `#${reporterId}`;
  }

  private navigate(params: { contestId: number | null; mode: Mode }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { contestId: params.contestId ?? null, mode: params.mode === 'mine' ? 'mine' : null },
      replaceUrl: true,
    });
  }

  private load(page: number): void {
    const contestId = this.selectedContestId();

    this.page.set(page);

    if (contestId === null) {
      this.rows.set([]);
      this.total.set(0);

      return;
    }

    const statuses = this.statuses().length ? this.statuses() : [...DEFAULT_STATUSES];
    const request: Observable<{ content: Application[]; total: number }> =
      this.selectedMode() === 'mine'
        ? this.api.myReporting(contestId).pipe(map((content) => ({ content, total: content.length })))
        : this.api
            .byContest(contestId, statuses, { page, size: this.size(), sort: 'createdAt,desc' })
            .pipe(map((result) => ({ content: result.content, total: result.totalElements })));

    this.loading.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ content, total }) => {
        this.rows.set(content);
        this.total.set(total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.api
      .readiness(contestId)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((readiness) =>
        this.reporters.set(
          new Map(
            (readiness?.reporters ?? [])
              .filter((reporter) => reporter.reporterId !== undefined)
              .map((reporter) => [reporter.reporterId as number, reporter.fullName ?? '']),
          ),
        ),
      );
  }
}
