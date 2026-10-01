import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  type OnInit,
  signal,
  type TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GridColumns, RenderTemplateData } from '@reforgium/data-grid';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ReserveApi } from '@domain/api/reserve.api';
import { formatScore } from '@features/rating/score-breakdown';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { DataTableComponent, type TablePage } from '@shared/ui/data-table/data-table.component';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { ReserveExcludeDialogComponent } from './exclude-dialog.component';

type Reserve = Schemas['ReserveResponse'];
type ReserveStatus = NonNullable<Reserve['status']>;
type Contest = Schemas['ContestResponse'];

const PAGE_SIZE = 20;
const STATUSES: readonly ReserveStatus[] = [
  'ACTIVE',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EXCLUDED',
  'APPOINTED',
  'CONFIRMED',
  'NOT_CONFIRMED',
];
/** Исключить можно позицию, которая ещё не закрыта (`ReserveStatus.FINAL`: EXCLUDED, APPOINTED, CONFIRMED). */
const EXCLUDABLE: ReadonlySet<ReserveStatus> = new Set([
  'ACTIVE',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'NOT_CONFIRMED',
]);

/** Резерв кандидатов (`/administrative/reserve`): `GET /candidate/reserve?contestId&status`, исключение с основаниями. */
@Component({
  selector: 'app-staff-reserve-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    Button,
    LocalDatePipe,
    Select,
    DataTableComponent,
    PageHeaderComponent,
    StatusTagComponent,
    ReserveExcludeDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="staff-reserve.title" subtitle="staff-reserve.subtitle">
      <p-select
        class="w-full desktop-s:w-80"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [filter]="true"
        [showClear]="true"
        [options]="contestOptions()"
        [loading]="contestsLoading()"
        [placeholder]="'staff-reserve.filter.all-contests' | lang"
        [ariaLabel]="'staff-applications.filter.contest' | lang"
        [ngModel]="contestId()"
        (ngModelChange)="setContest($event)"
      />
      <p-select
        class="w-full desktop-s:w-64"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [showClear]="true"
        [options]="statusOptions()"
        [placeholder]="'staff-reserve.filter.all-statuses' | lang"
        [ariaLabel]="'staff-reserve.filter.status' | lang"
        [ngModel]="status()"
        (ngModelChange)="setStatus($event)"
      />
    </app-page-header>

    <div class="rounded-xl border border-surface-200 bg-surface-0 p-2 tablet:p-4">
      <app-data-table
        [rows]="rows()"
        [columns]="columns()"
        [loading]="loading()"
        [total]="total()"
        [page]="page()"
        [size]="size()"
        emptyText="staff-reserve.empty"
        (pageChange)="onPage($event)"
      />
    </div>

    <ng-template #candidateCell let-row="row">
      <a
        class="font-medium text-primary no-underline hover:underline"
        [routerLink]="['/administrative/applications', row.applicationId]"
      >
        {{ row.candidateFullName || '#' + row.candidateId }}
      </a>
    </ng-template>
    <ng-template #statusCell let-row="row">
      <app-status-tag kind="reserve" [value]="row.status" />
    </ng-template>
    <ng-template #expiresCell let-row="row">
      <span [class.text-red-700]="row.expired">{{ row.expiresAt | localDate }}</span>
    </ng-template>
    <ng-template #actionsCell let-row="row">
      @if (excludable(row)) {
        <p-button
          size="small"
          icon="pi pi-user-minus"
          severity="danger"
          [text]="true"
          [ariaLabel]="'staff-reserve.actions.exclude' | lang"
          (onClick)="openExclude(row)"
        />
      }
    </ng-template>

    <app-reserve-exclude-dialog [(visible)]="excluding" [reserve]="selected()" (excluded)="replace($event)" />
  `,
})
export default class StaffReservePage implements OnInit {
  private readonly api = inject(ReserveApi);
  private readonly contestApi = inject(ContestApi);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly candidateCell = viewChild.required<TemplateRef<RenderTemplateData<Reserve>>>('candidateCell');
  private readonly statusCell = viewChild.required<TemplateRef<RenderTemplateData<Reserve>>>('statusCell');
  private readonly expiresCell = viewChild.required<TemplateRef<RenderTemplateData<Reserve>>>('expiresCell');
  private readonly actionsCell = viewChild.required<TemplateRef<RenderTemplateData<Reserve>>>('actionsCell');

  protected readonly rows = signal<Reserve[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(PAGE_SIZE);
  protected readonly contestId = signal<number | null>(null);
  protected readonly status = signal<ReserveStatus | null>(null);
  protected readonly contests = signal<Contest[]>([]);
  protected readonly contestsLoading = signal(true);
  protected readonly excluding = signal(false);
  protected readonly selected = signal<Reserve | null>(null);

  protected readonly contestOptions = computed(() =>
    this.contests()
      .filter((contest) => contest.id !== undefined)
      .map((contest) => ({ value: contest.id as number, label: contest.name || `#${contest.id}` })),
  );
  private readonly statusLabels = STATUSES.map((value) => ({
    value,
    label: this.lang.observe(`status.reserve.${value}`),
  }));
  protected readonly statusOptions = computed(() =>
    this.statusLabels.map(({ value, label }) => ({ value, label: label() })),
  );

  protected readonly columns = computed<GridColumns<Reserve>>(() => {
    this.lang.currentLang();

    const header = (key: string) => this.lang.get(`staff-reserve.columns.${key}`);
    const track = (row: Reserve) => String(row.id);
    const contestName = (id: number | undefined) => this.contests().find((contest) => contest.id === id)?.name;

    return [
      {
        key: 'candidateFullName',
        header: header('candidate'),
        flex: 2,
        minWidth: 220,
        track,
        renderTemplate: this.candidateCell(),
      },
      {
        key: 'contestId',
        header: header('contest'),
        flex: 2,
        minWidth: 200,
        track,
        value: (row) => contestName(row.contestId) || `#${row.contestId}`,
      },
      { key: 'status', header: header('status'), minWidth: 200, track, renderTemplate: this.statusCell() },
      {
        key: 'totalScore',
        header: header('total'),
        minWidth: 100,
        align: 'right',
        track,
        value: (row) => formatScore(row.totalScore),
      },
      { key: 'expiresAt', header: header('expires'), minWidth: 130, track, renderTemplate: this.expiresCell() },
      { key: 'actions', header: '', width: 64, align: 'right', track, renderTemplate: this.actionsCell() },
    ];
  });

  ngOnInit(): void {
    this.contestApi
      .all({ size: 200, sort: 'createdAt,desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.contests.set(result.content);
          this.contestsLoading.set(false);
        },
        error: () => this.contestsLoading.set(false),
      });
    this.load(0, PAGE_SIZE);
  }

  protected setContest(contestId: number | null): void {
    this.contestId.set(contestId ?? null);
    this.load(0, this.size());
  }

  protected setStatus(status: ReserveStatus | null): void {
    this.status.set(status ?? null);
    this.load(0, this.size());
  }

  protected onPage({ page, size }: TablePage): void {
    this.load(page, size);
  }

  protected excludable(row: Reserve): boolean {
    return !!row.status && EXCLUDABLE.has(row.status);
  }

  protected openExclude(row: Reserve): void {
    this.selected.set(row);
    this.excluding.set(true);
  }

  protected replace(reserve: Reserve): void {
    this.rows.update((rows) => rows.map((row) => (row.id === reserve.id ? reserve : row)));
  }

  private load(page: number, size: number): void {
    this.loading.set(true);
    this.api
      .list({ contestId: this.contestId() ?? undefined, status: this.status() ?? undefined, page, size })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.rows.set(result.content);
          this.total.set(result.totalElements);
          this.page.set(result.page);
          this.size.set(result.size || size);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
