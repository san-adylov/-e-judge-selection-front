import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';

import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import {
  type Confirmation,
  CONFIRMATION_STATUSES,
  type ConfirmationStatus,
  JUDGE_STATUSES,
  type JudgeApplication,
  JUDGES_URL,
  type JudgeStatus,
} from './judge-rules';

type Tab = 'applications' | 'confirmations';

const PAGE_SIZE = 20;

/**
 * Судьи (`/administrative/judges`): заявки действующих судей на конкурсы (`GET /judge-applications/under-review`
 * или по статусу) и подтверждения статуса судьи (`GET /active-judge-confirmations?status`).
 */
@Component({
  selector: 'app-staff-judges-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    ServerDateTimePipe,
    Paginator,
    Select,
    SelectButton,
    Skeleton,
    PageHeaderComponent,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './judges.page.html',
})
export default class StaffJudgesPage implements OnInit {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly names = inject(CandidateNamesStore);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly baseUrl = JUDGES_URL;
  protected readonly size = PAGE_SIZE;
  protected readonly tab = signal<Tab>('applications');
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly applications = signal<JudgeApplication[]>([]);
  protected readonly confirmations = signal<Confirmation[]>([]);
  protected readonly status = signal<JudgeStatus | null>(null);
  protected readonly confirmationStatus = signal<ConfirmationStatus | null>('PENDING_SECRETARY_REVIEW');

  protected readonly tabOptions = computed(() => {
    this.lang.currentLang();

    return (['applications', 'confirmations'] as const).map((value) => ({
      value,
      label: this.lang.get(`staff-judges.tabs.${value}`),
    }));
  });
  private readonly statusLabels = JUDGE_STATUSES.map((value) => ({
    value,
    label: this.lang.observe(`status.judgeApplication.${value}`),
  }));
  private readonly confirmationLabels = CONFIRMATION_STATUSES.map((value) => ({
    value,
    label: this.lang.observe(`status.judgeConfirmation.${value}`),
  }));
  protected readonly statusOptions = computed(() =>
    this.statusLabels.map(({ value, label }) => ({ value, label: label() })),
  );
  protected readonly confirmationOptions = computed(() =>
    this.confirmationLabels.map(({ value, label }) => ({ value, label: label() })),
  );
  private readonly judgeNames = computed(() =>
    this.names.namesOf([
      ...this.applications().map((item) => item.judgeUserId),
      ...this.confirmations().map((item) => item.userId),
    ])(),
  );

  ngOnInit(): void {
    this.load(0);
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.load(0);
  }

  protected setStatus(status: JudgeStatus | null): void {
    this.status.set(status ?? null);
    this.load(0);
  }

  protected setConfirmationStatus(status: ConfirmationStatus | null): void {
    this.confirmationStatus.set(status ?? null);
    this.load(0);
  }

  protected onPage(state: PaginatorState): void {
    this.load(Math.floor((state.first ?? 0) / PAGE_SIZE));
  }

  protected name(userId: number | undefined): string {
    if (userId === undefined) return '—';

    const name = this.judgeNames().get(userId);

    return name === undefined ? '…' : name || `#${userId}`;
  }

  private load(page: number): void {
    const query = { page, size: PAGE_SIZE, sort: 'createdAt,desc' };

    this.loading.set(true);
    this.page.set(page);

    if (this.tab() === 'applications') {
      const status = this.status();
      const request = status ? this.api.list({ status, ...query }) : this.api.underReview(query);

      request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => {
          this.applications.set(result.content);
          this.total.set(result.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

      return;
    }

    this.api
      .confirmations(this.confirmationStatus() ?? undefined, query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.confirmations.set(result.content);
          this.total.set(result.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
