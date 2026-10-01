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

import { VacanciesApi } from '@domain/api/vacancies.api';
import { AccessDirective } from '@shared/auth/access.directive';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { DataTableComponent, type TablePage } from '@shared/ui/data-table/data-table.component';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { VacancyFormDialogComponent } from './vacancy-form-dialog.component';
import { freePlaces, VACANCIES_URL, type Vacancy, VACANCY_STATUSES, type VacancyStatus } from './vacancy-rules';

const PAGE_SIZE = 20;

/** Вакансии (`/administrative/vacancies`): `GET /vacancy?status`; создание — председатель (вместе с заседанием). */
@Component({
  selector: 'app-staff-vacancies-page',
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
    VacancyFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="staff-vacancies.title" subtitle="staff-vacancies.subtitle">
      <p-select
        class="w-full tablet:w-64"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [showClear]="true"
        [options]="statusOptions()"
        [placeholder]="'staff-vacancies.filter.all-statuses' | lang"
        [ariaLabel]="'staff-vacancies.filter.status' | lang"
        [ngModel]="status()"
        (ngModelChange)="setStatus($event)"
      />
      <p-button
        *appAccess="'CHAIRMAN'"
        icon="pi pi-plus"
        [label]="'staff-vacancies.form.create-action' | lang"
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
        emptyText="staff-vacancies.empty"
        (pageChange)="onPage($event)"
        (rowClick)="open($event)"
      />
    </div>

    <ng-template #nameCell let-row="row">
      <a class="font-medium text-primary no-underline hover:underline" [routerLink]="[baseUrl, row.id]">
        {{ row.name || '#' + row.id }}
      </a>
    </ng-template>
    <ng-template #statusCell let-row="row">
      <app-status-tag kind="vacancy" [value]="row.status" />
    </ng-template>

    <app-vacancy-form-dialog [(visible)]="creating" (saved)="open($event)" />
  `,
})
export default class StaffVacanciesPage implements OnInit {
  private readonly api = inject(VacanciesApi);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly localDate = new LocalDatePipe();

  private readonly nameCell = viewChild.required<TemplateRef<RenderTemplateData<Vacancy>>>('nameCell');
  private readonly statusCell = viewChild.required<TemplateRef<RenderTemplateData<Vacancy>>>('statusCell');

  protected readonly baseUrl = VACANCIES_URL;
  protected readonly rows = signal<Vacancy[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(PAGE_SIZE);
  protected readonly status = signal<VacancyStatus | null>(null);
  protected readonly creating = signal(false);

  private readonly statusLabels = VACANCY_STATUSES.map((value) => ({
    value,
    label: this.lang.observe(`status.vacancy.${value}`),
  }));
  protected readonly statusOptions = computed(() =>
    this.statusLabels.map(({ value, label }) => ({ value, label: label() })),
  );

  protected readonly columns = computed<GridColumns<Vacancy>>(() => {
    this.lang.currentLang();

    const header = (key: string) => this.lang.get(`staff-vacancies.columns.${key}`);
    const track = (row: Vacancy) => String(row.id);

    return [
      { key: 'name', header: header('name'), flex: 3, minWidth: 240, track, renderTemplate: this.nameCell() },
      { key: 'status', header: header('status'), minWidth: 180, track, renderTemplate: this.statusCell() },
      {
        key: 'quantity',
        header: header('places'),
        minWidth: 120,
        align: 'right',
        track,
        value: (row) => `${freePlaces(row)} / ${row.quantity ?? 0}`,
      },
      {
        key: 'startDate',
        header: header('start'),
        minWidth: 120,
        track,
        value: (row) => this.localDate.transform(row.startDate),
      },
      {
        key: 'endDate',
        header: header('end'),
        minWidth: 120,
        track,
        value: (row) => this.localDate.transform(row.endDate),
      },
    ];
  });

  ngOnInit(): void {
    this.load(0, PAGE_SIZE);
  }

  protected setStatus(status: VacancyStatus | null): void {
    this.status.set(status ?? null);
    this.load(0, this.size());
  }

  protected onPage({ page, size }: TablePage): void {
    this.load(page, size);
  }

  protected open(vacancy: Vacancy): void {
    if (vacancy.id !== undefined) void this.router.navigate([VACANCIES_URL, vacancy.id]);
  }

  private load(page: number, size: number): void {
    this.loading.set(true);
    this.api
      .list(this.status() ?? undefined, { page, size, sort: 'createdAt,desc' })
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
