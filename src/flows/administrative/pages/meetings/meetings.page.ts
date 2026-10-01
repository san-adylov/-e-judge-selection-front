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
import { Router, RouterLink } from '@angular/router';
import type { GridColumns, RenderTemplateData } from '@reforgium/data-grid';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { MultiSelect } from 'primeng/multiselect';

import type { MeetingStatus } from '@domain/api/api.types';
import { MeetingsApi } from '@domain/api/meetings.api';
import { AccessDirective } from '@shared/auth/access.directive';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { DataTableComponent, type TablePage } from '@shared/ui/data-table/data-table.component';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { type Meeting, MEETING_STATUSES, MEETINGS_URL } from './meeting-rules';
import { ScheduleMeetingDialogComponent } from './schedule-meeting-dialog.component';

const PAGE_SIZE = 20;
const DEFAULT_STATUSES: readonly MeetingStatus[] = ['APPOINTED', 'OPENED'];

/**
 * Заседания (`/administrative/meetings`): `GET /meeting?status`, назначение заседания этапа конкурса (Совет).
 * `?contestId=` с карточки конкурса сразу открывает форму назначения.
 */
@Component({
  selector: 'app-meetings-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    Button,
    MultiSelect,
    AccessDirective,
    DataTableComponent,
    PageHeaderComponent,
    StatusTagComponent,
    ScheduleMeetingDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="staff-meetings.title" subtitle="staff-meetings.subtitle">
      <p-multiselect
        class="w-full tablet:w-80"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        display="chip"
        [options]="statusOptions()"
        [placeholder]="'staff-meetings.filter.status' | lang"
        [ariaLabel]="'staff-meetings.filter.status' | lang"
        [ngModel]="statuses()"
        (ngModelChange)="setStatuses($event)"
      />
      <p-button
        *appAccess="'COUNCIL'"
        icon="pi pi-calendar-plus"
        [label]="'staff-meetings.schedule.action' | lang"
        (onClick)="scheduling.set(true)"
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
        emptyText="staff-meetings.empty"
        (pageChange)="onPage($event)"
        (rowClick)="open($event)"
      />
    </div>

    <ng-template #titleCell let-row="row">
      <a class="font-medium text-primary no-underline hover:underline" [routerLink]="[baseUrl, row.id]">
        {{ row.title || ('staff-meetings.detail.untitled' | lang) }}
      </a>
    </ng-template>
    <ng-template #typeCell let-row="row">
      <app-status-tag kind="meetingType" [value]="row.type" />
    </ng-template>
    <ng-template #statusCell let-row="row">
      <app-status-tag kind="meeting" [value]="row.status" />
    </ng-template>

    <app-schedule-meeting-dialog [(visible)]="scheduling" [contestId]="presetContestId()" (scheduled)="open($event)" />
  `,
})
export default class MeetingsPage {
  private readonly api = inject(MeetingsApi);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateTime = new ServerDateTimePipe();

  private readonly titleCell = viewChild.required<TemplateRef<RenderTemplateData<Meeting>>>('titleCell');
  private readonly typeCell = viewChild.required<TemplateRef<RenderTemplateData<Meeting>>>('typeCell');
  private readonly statusCell = viewChild.required<TemplateRef<RenderTemplateData<Meeting>>>('statusCell');

  /** `?contestId=` — предзаполнение формы назначения с карточки конкурса. */
  readonly contestId = input<string | undefined>();

  protected readonly baseUrl = MEETINGS_URL;
  protected readonly rows = signal<Meeting[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(PAGE_SIZE);
  protected readonly statuses = signal<MeetingStatus[]>([...DEFAULT_STATUSES]);
  protected readonly scheduling = signal(false);
  protected readonly presetContestId = computed(() => {
    const id = Number(this.contestId());

    return Number.isInteger(id) && id > 0 ? id : null;
  });

  private readonly statusLabels = MEETING_STATUSES.map((value) => ({
    value,
    label: this.lang.observe(`status.meeting.${value}`),
  }));
  protected readonly statusOptions = computed(() =>
    this.statusLabels.map(({ value, label }) => ({ value, label: label() })),
  );

  protected readonly columns = computed<GridColumns<Meeting>>(() => {
    this.lang.currentLang();

    const header = (key: string) => this.lang.get(`staff-meetings.columns.${key}`);
    const track = (row: Meeting) => String(row.id);

    return [
      { key: 'title', header: header('title'), flex: 3, minWidth: 260, track, renderTemplate: this.titleCell() },
      { key: 'type', header: header('type'), minWidth: 220, track, renderTemplate: this.typeCell() },
      { key: 'status', header: header('status'), minWidth: 140, track, renderTemplate: this.statusCell() },
      {
        key: 'startDateTime',
        header: header('start'),
        minWidth: 160,
        track,
        value: (row) => this.dateTime.transform(row.startDateTime),
      },
      {
        key: 'participantCount',
        header: header('participants'),
        minWidth: 120,
        align: 'right',
        track,
        value: (row) => row.participantCount ?? 0,
      },
    ];
  });

  constructor() {
    effect(() => {
      const preset = this.presetContestId();

      untracked(() => {
        this.load(0, PAGE_SIZE);
        if (preset !== null) this.scheduling.set(true);
      });
    });
  }

  protected setStatuses(statuses: MeetingStatus[]): void {
    this.statuses.set(statuses);
    this.load(0, this.size());
  }

  protected onPage({ page, size }: TablePage): void {
    this.load(page, size);
  }

  protected open(meeting: Meeting): void {
    if (meeting.id !== undefined) void this.router.navigate([MEETINGS_URL, meeting.id]);
  }

  private load(page: number, size: number): void {
    const statuses = this.statuses().length ? this.statuses() : [...MEETING_STATUSES];

    this.loading.set(true);
    this.api
      .byStatus(statuses, { page, size, sort: 'startDateTime,desc' })
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
