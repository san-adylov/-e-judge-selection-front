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
import { Router, RouterLink } from '@angular/router';
import type { GridColumns, RenderTemplateData } from '@reforgium/data-grid';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import type { Observable } from 'rxjs';

import type { ContestStatus, Page } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { AccessDirective } from '@shared/auth/access.directive';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { DataTableComponent, type TablePage } from '@shared/ui/data-table/data-table.component';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { ContestCreateDialogComponent } from './contest-create-dialog.component';
import { type Contest, CONTEST_STATUSES, CONTESTS_URL } from './contest-rules';

const PAGE_SIZE = 20;

/**
 * Конкурсы для сотрудников (`/administrative/contests`): `GET /contest/all`, фильтр по статусу — `GET /contest?status`.
 * Создаёт председатель (название), заполняет и публикует секретарь — на карточке конкурса.
 */
@Component({
  selector: 'app-staff-contests-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    Button,
    Select,
    AccessDirective,
    DataTableComponent,
    PageHeaderComponent,
    StatusTagComponent,
    ContestCreateDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="staff-contests.title" subtitle="staff-contests.subtitle">
      <p-select
        class="w-full tablet:w-72"
        optionLabel="label"
        optionValue="value"
        [options]="statusOptions()"
        [showClear]="true"
        [placeholder]="'staff-contests.filter.all-statuses' | lang"
        [ariaLabel]="'staff-contests.filter.status' | lang"
        [ngModel]="status()"
        (ngModelChange)="setStatus($event)"
      />
      <p-button
        *appAccess="'CHAIRMAN'"
        icon="pi pi-plus"
        [label]="'staff-contests.create.action' | lang"
        (onClick)="creating.set(true)"
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
        emptyText="staff-contests.empty"
        (pageChange)="onPage($event)"
        (rowClick)="open($event)"
      />
    </div>

    <ng-template #nameCell let-row="row">
      <a class="font-medium text-primary no-underline hover:underline" [routerLink]="[baseUrl, row.id]">
        {{ row.name || '—' }}
      </a>
    </ng-template>
    <ng-template #statusCell let-row="row">
      <app-status-tag kind="contest" [value]="row.status" />
    </ng-template>
    <ng-template #typeCell let-row="row">
      <app-status-tag kind="contestType" [value]="row.type" />
    </ng-template>

    <app-contest-create-dialog [(visible)]="creating" (created)="open($event)" />
  `,
})
export default class StaffContestsPage implements OnInit {
  private readonly api = inject(ContestApi);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly localDate = new LocalDatePipe();

  private readonly nameCell = viewChild.required<TemplateRef<RenderTemplateData<Contest>>>('nameCell');
  private readonly statusCell = viewChild.required<TemplateRef<RenderTemplateData<Contest>>>('statusCell');
  private readonly typeCell = viewChild.required<TemplateRef<RenderTemplateData<Contest>>>('typeCell');

  protected readonly baseUrl = CONTESTS_URL;
  protected readonly rows = signal<Contest[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(PAGE_SIZE);
  protected readonly status = signal<ContestStatus | null>(null);
  protected readonly creating = signal(false);

  /** `observe` следит за языком: подписи статусов в фильтре меняются вместе с интерфейсом. */
  private readonly statusLabels = CONTEST_STATUSES.map((value) => ({
    value,
    label: this.lang.observe(`status.contest.${value}`),
  }));
  protected readonly statusOptions = computed(() =>
    this.statusLabels.map(({ value, label }) => ({ value, label: label() })),
  );

  protected readonly columns = computed<GridColumns<Contest>>(() => {
    // Чтение `currentLang` — зависимость: заголовки пересчитываются при смене языка.
    this.lang.currentLang();

    const header = (key: string) => this.lang.get(`staff-contests.columns.${key}`);
    const track = (row: Contest) => String(row.id);

    return [
      { key: 'name', header: header('name'), flex: 3, minWidth: 260, track, renderTemplate: this.nameCell() },
      { key: 'type', header: header('type'), minWidth: 170, track, renderTemplate: this.typeCell() },
      { key: 'status', header: header('status'), minWidth: 220, track, renderTemplate: this.statusCell() },
      {
        key: 'startDate',
        header: header('start-date'),
        minWidth: 130,
        track,
        value: (row) => this.localDate.transform(row.startDate),
      },
      {
        key: 'documentAcceptanceEndDate',
        header: header('end-date'),
        minWidth: 130,
        track,
        value: (row) => this.localDate.transform(row.documentAcceptanceEndDate),
      },
      {
        key: 'vacantPlaces',
        header: header('vacant-places'),
        minWidth: 110,
        align: 'right',
        track,
        value: (row) => row.vacantPlaces ?? '—',
      },
    ];
  });

  ngOnInit(): void {
    this.load(0, PAGE_SIZE);
  }

  protected setStatus(status: ContestStatus | null): void {
    this.status.set(status ?? null);
    this.load(0, this.size());
  }

  protected onPage({ page, size }: TablePage): void {
    this.load(page, size);
  }

  protected open(contest: Contest): void {
    if (contest.id !== undefined) void this.router.navigate([CONTESTS_URL, contest.id]);
  }

  private load(page: number, size: number): void {
    const status = this.status();
    const query = { page, size, sort: 'createdAt,desc' };
    const request: Observable<Page<Contest>> = status ? this.api.byStatus([status], query) : this.api.all(query);

    this.loading.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
