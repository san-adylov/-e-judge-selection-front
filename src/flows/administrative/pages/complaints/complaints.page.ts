import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';

import type { Schemas } from '@domain/api/api.types';
import { ComplaintsApi } from '@domain/api/complaints.api';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { ComplaintCardComponent } from './complaint-card.component';
import { ComplaintReviewDialogComponent } from './complaint-review-dialog.component';

type Complaint = Schemas['ComplaintResponse'];
type ComplaintType = NonNullable<Complaint['type']>;
type ComplaintStatus = NonNullable<Complaint['status']>;
type Contest = Schemas['ContestResponse'];

const PAGE_SIZE = 10;
const TYPES: readonly ComplaintType[] = ['DOCUMENT_STAGE', 'TEST_RESULT', 'CONTEST_VIOLATION'];
const STATUSES: readonly ComplaintStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

/** Жалобы кандидатов для сотрудников (`/administrative/complaints`): `GET /complaints?type&status&contestId`. */
@Component({
  selector: 'app-staff-complaints-page',
  imports: [
    FormsModule,
    LangPipe,
    Paginator,
    Select,
    Skeleton,
    PageHeaderComponent,
    ComplaintCardComponent,
    ComplaintReviewDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="staff-complaints.title" subtitle="staff-complaints.subtitle" />

    <div class="mb-4 flex flex-col gap-3 desktop-s:flex-row">
      <p-select
        class="w-full desktop-s:w-80"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [filter]="true"
        [showClear]="true"
        [options]="contestOptions()"
        [placeholder]="'staff-reserve.filter.all-contests' | lang"
        [ariaLabel]="'staff-applications.filter.contest' | lang"
        [ngModel]="contestId()"
        (ngModelChange)="contestId.set($event); load(0)"
      />
      <p-select
        class="w-full desktop-s:w-64"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [showClear]="true"
        [options]="typeOptions()"
        [placeholder]="'staff-complaints.filter.all-types' | lang"
        [ariaLabel]="'staff-complaints.filter.type' | lang"
        [ngModel]="type()"
        (ngModelChange)="type.set($event); load(0)"
      />
      <p-select
        class="w-full desktop-s:w-64"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [showClear]="true"
        [options]="statusOptions()"
        [placeholder]="'staff-complaints.filter.all-statuses' | lang"
        [ariaLabel]="'staff-complaints.filter.status' | lang"
        [ngModel]="status()"
        (ngModelChange)="status.set($event); load(0)"
      />
    </div>

    <div class="flex max-w-5xl flex-col gap-4">
      @if (loading()) {
        @for (row of [1, 2, 3]; track row) {
          <p-skeleton height="9rem" borderRadius="0.75rem" />
        }
      } @else {
        @for (item of items(); track item.id) {
          <app-complaint-card [complaint]="item" (review)="openReview($event)" (changed)="replace($event)" />
        } @empty {
          <div class="rounded-xl border border-surface-200 bg-surface-0 p-8 text-center text-surface-500">
            {{ 'staff-complaints.empty' | lang }}
          </div>
        }
      }

      @if (total() > size) {
        <p-paginator [rows]="size" [first]="page() * size" [totalRecords]="total()" (onPageChange)="onPage($event)" />
      }
    </div>

    <app-complaint-review-dialog
      [(visible)]="reviewing"
      [complaint]="selected()"
      [contestId]="selectedContestId()"
      (attached)="replace($event)"
    />
  `,
})
export default class StaffComplaintsPage implements OnInit {
  private readonly api = inject(ComplaintsApi);
  private readonly contestApi = inject(ContestApi);
  private readonly applicationsApi = inject(ContestApplicationApi);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly size = PAGE_SIZE;
  protected readonly items = signal<Complaint[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly contestId = signal<number | null>(null);
  protected readonly type = signal<ComplaintType | null>(null);
  protected readonly status = signal<ComplaintStatus | null>(null);
  protected readonly contests = signal<Contest[]>([]);
  protected readonly reviewing = signal(false);
  protected readonly selected = signal<Complaint | null>(null);
  /** Конкурс выбранной жалобы — через её заявку (в `ComplaintResponse` его нет). */
  protected readonly selectedContestId = signal<number | null>(null);

  protected readonly contestOptions = computed(() =>
    this.contests()
      .filter((contest) => contest.id !== undefined)
      .map((contest) => ({ value: contest.id as number, label: contest.name || `#${contest.id}` })),
  );
  private readonly typeLabels = TYPES.map((value) => ({
    value,
    label: this.lang.observe(`status.complaintType.${value}`),
  }));
  private readonly statusLabels = STATUSES.map((value) => ({
    value,
    label: this.lang.observe(`status.complaint.${value}`),
  }));
  protected readonly typeOptions = computed(() =>
    this.typeLabels.map(({ value, label }) => ({ value, label: label() })),
  );
  protected readonly statusOptions = computed(() =>
    this.statusLabels.map(({ value, label }) => ({ value, label: label() })),
  );

  ngOnInit(): void {
    this.contestApi
      .all({ size: 200, sort: 'createdAt,desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (result) => this.contests.set(result.content), error: () => undefined });
    this.load(0);
  }

  protected load(page: number): void {
    this.loading.set(true);
    this.api
      .list({
        contestId: this.contestId() ?? undefined,
        type: this.type() ?? undefined,
        status: this.status() ?? undefined,
        page,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.items.set(result.content);
          this.total.set(result.totalElements);
          this.page.set(result.page);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected onPage(state: PaginatorState): void {
    this.load(Math.floor((state.first ?? 0) / PAGE_SIZE));
  }

  protected openReview(complaint: Complaint): void {
    this.selected.set(complaint);
    this.selectedContestId.set(this.contestId());

    if (this.contestId() === null && complaint.applicationId !== undefined) {
      this.applicationsApi
        .get(complaint.applicationId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (application) => this.selectedContestId.set(application.contestId ?? null),
          error: () => undefined,
        });
    }

    this.reviewing.set(true);
  }

  protected replace(complaint: Complaint): void {
    this.items.update((items) => items.map((item) => (item.id === complaint.id ? complaint : item)));
  }
}
