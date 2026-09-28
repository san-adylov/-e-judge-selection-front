import { ChangeDetectionStrategy, Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';

import { ComplaintsApi } from '@domain/api/complaints.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { ComplaintDetailsDialogComponent } from './complaint-details-dialog.component';
import {
  type Application,
  applicationLabel,
  type Complaint,
  COMPLAINT_TYPES,
  type ComplaintPreset,
  DOCUMENT_STAGE_DEADLINE_DAYS,
  presetFromQuery,
} from './complaint-rules';
import { ComplaintSubmitDialogComponent } from './complaint-submit-dialog.component';

const PAGE_SIZE = 10;

/**
 * Жалобы кандидата (`/cabinet/complaints`): список `GET /v1/complaints/my`, карточка и подача.
 * Ссылка с других экранов: `/cabinet/complaints?applicationId=12&type=TEST_RESULT` сразу открывает форму.
 */
@Component({
  selector: 'app-complaints-page',
  imports: [
    LangPipe,
    ServerDateTimePipe,
    Button,
    Paginator,
    Skeleton,
    PageHeaderComponent,
    StatusTagComponent,
    ComplaintDetailsDialogComponent,
    ComplaintSubmitDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="complaints.title" subtitle="complaints.subtitle">
      <p-button
        icon="pi pi-plus"
        [label]="'complaints.actions.submit' | lang"
        [disabled]="!applicationsLoaded()"
        (onClick)="openSubmit(null)"
      />
    </app-page-header>

    <div class="flex max-w-5xl flex-col gap-4">
      <section class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
        <h2 class="m-0 text-base font-semibold">{{ 'complaints.rules.title' | lang }}</h2>
        <ul class="m-0 mt-2 flex flex-col gap-1 pl-5 text-sm text-surface-700">
          @for (type of types; track type) {
            <li>{{ 'complaints.rules.' + type | lang: { days: deadlineDays } }}</li>
          }
          <li>{{ 'complaints.rules.one-per-type' | lang }}</li>
        </ul>
      </section>

      @if (loading() && !items().length) {
        @for (row of [1, 2, 3]; track row) {
          <div class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
            <p-skeleton height="1.5rem" width="40%" />
            <p-skeleton styleClass="mt-3" height="3rem" />
          </div>
        }
      } @else if (failed()) {
        <div class="rounded-xl border border-surface-200 bg-surface-0 p-8 text-center">
          <p class="m-0 mb-3 text-surface-500">{{ 'complaints.list.load-error' | lang }}</p>
          <p-button
            icon="pi pi-refresh"
            severity="secondary"
            [outlined]="true"
            [label]="'complaints.actions.retry' | lang"
            (onClick)="load(page())"
          />
        </div>
      } @else {
        @for (item of items(); track item.id) {
          <article class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
            <div class="flex flex-wrap items-center gap-2">
              <app-status-tag kind="complaintType" [value]="item.type" />
              <app-status-tag kind="complaint" [value]="item.status" />
              <span class="text-sm text-surface-500 tablet:ml-auto">
                {{ 'complaints.list.submitted-at' | lang }} {{ item.createdAt | serverDateTime }}
              </span>
            </div>
            <div class="mt-3 font-medium">{{ label(item) }}</div>
            <p class="m-0 mt-2 line-clamp-3 whitespace-pre-line break-words text-sm text-surface-700">
              {{ item.text }}
            </p>
            <div class="mt-3 flex justify-end">
              <p-button
                icon="pi pi-angle-right"
                iconPos="right"
                size="small"
                [text]="true"
                [label]="'complaints.actions.details' | lang"
                (onClick)="openDetails(item)"
              />
            </div>
          </article>
        } @empty {
          <div class="rounded-xl border border-surface-200 bg-surface-0 p-8 text-center text-surface-500">
            <i class="pi pi-inbox mb-2 block text-3xl"></i>
            {{ 'complaints.list.empty' | lang }}
          </div>
        }
      }

      @if (total() > size) {
        <p-paginator [rows]="size" [first]="page() * size" [totalRecords]="total()" (onPageChange)="onPage($event)" />
      }
    </div>

    <app-complaint-submit-dialog
      [visible]="submitOpen()"
      [applications]="applications()"
      [preset]="preset()"
      (visibleChange)="onSubmitVisible($event)"
      (submitted)="load(0)"
    />

    <app-complaint-details-dialog
      [complaintId]="detailsId()"
      [applicationLabel]="detailsLabel()"
      [(visible)]="detailsOpen"
      (changed)="replace($event)"
    />
  `,
})
export default class ComplaintsPage implements OnInit {
  private readonly api = inject(ComplaintsApi);
  private readonly applicationApi = inject(ContestApplicationApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Query-параметры для перехода с других экранов (`withComponentInputBinding`). */
  readonly applicationId = input<string | undefined>();
  readonly type = input<string | undefined>();

  protected readonly types = COMPLAINT_TYPES;
  protected readonly deadlineDays = DOCUMENT_STAGE_DEADLINE_DAYS;
  protected readonly size = PAGE_SIZE;

  protected readonly items = signal<Complaint[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly applications = signal<Application[]>([]);
  protected readonly applicationsLoaded = signal(false);
  protected readonly submitOpen = signal(false);
  protected readonly preset = signal<ComplaintPreset | null>(null);
  protected readonly detailsId = signal<number | null>(null);
  protected readonly detailsOpen = signal(false);

  private readonly byId = computed(() => new Map(this.applications().map((item) => [item.id, item])));
  protected readonly detailsLabel = computed(() => {
    const id = this.detailsId();

    return id === null ? '' : this.label(this.items().find((item) => item.id === id) ?? {});
  });

  ngOnInit(): void {
    this.load(0);
    this.loadApplications();
  }

  protected load(page: number): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.my({ page, size: PAGE_SIZE }).subscribe({
      next: (result) => {
        this.items.set(result.content);
        this.total.set(result.totalElements);
        this.page.set(result.page);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  protected label(complaint: Complaint): string {
    return applicationLabel(this.byId().get(complaint.applicationId), complaint.applicationId);
  }

  protected openSubmit(preset: ComplaintPreset | null): void {
    this.preset.set(preset);
    this.submitOpen.set(true);
  }

  protected onSubmitVisible(visible: boolean): void {
    this.submitOpen.set(visible);

    if (visible || !this.preset()) return;

    // Предвыбор из ссылки нужен один раз: убираем query-параметры, чтобы форма не открылась снова.
    this.preset.set(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  protected openDetails(complaint: Complaint): void {
    this.detailsId.set(complaint.id ?? null);
    this.detailsOpen.set(true);
  }

  protected replace(complaint: Complaint): void {
    this.items.update((items) => items.map((item) => (item.id === complaint.id ? { ...item, ...complaint } : item)));
  }

  protected onPage(state: PaginatorState): void {
    this.load(Math.floor((state.first ?? 0) / PAGE_SIZE));
  }

  private loadApplications(): void {
    this.applicationApi.my({ size: 100 }).subscribe({
      next: (result) => {
        this.applications.set(result.content);
        this.applicationsLoaded.set(true);

        const preset = presetFromQuery(this.applicationId(), this.type());

        if (preset) this.openSubmit(preset);
      },
      error: () => this.applicationsLoaded.set(true),
    });
  }
}
