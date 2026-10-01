import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { map, type Observable } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { SessionService } from '@shared/auth/session.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { ASSESSMENT_URL } from './assessment-rules';

type Application = Schemas['ApplicationResponse'];
type Contest = Schemas['ContestResponse'];

/**
 * Выбор заявки для оценки: конкурс → заявки у Совета (`PENDING_BOARD_REVIEW`). Член Совета видит свои доклады
 * (`GET /my-reporting`), секретарь — все заявки этапа (`GET /by-contest`).
 */
@Component({
  selector: 'app-assessment-picker',
  imports: [FormsModule, RouterLink, LangPipe, Select, Skeleton, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    <p-select
      class="w-full desktop-s:w-96"
      optionLabel="label"
      optionValue="value"
      appendTo="body"
      [filter]="true"
      [options]="contestOptions()"
      [loading]="contestsLoading()"
      [placeholder]="'staff-applications.filter.contest' | lang"
      [ariaLabel]="'staff-applications.filter.contest' | lang"
      [ngModel]="contestId()"
      (ngModelChange)="setContest($event)"
    />

    @if (contestId() === null) {
      <section
        class="flex flex-col items-center gap-2 rounded-xl border border-surface-200 bg-surface-0 p-8 text-center"
      >
        <i class="pi pi-megaphone text-3xl text-surface-400" aria-hidden="true"></i>
        <p class="m-0 text-surface-600">{{ 'staff-assessment.picker.select-contest' | lang }}</p>
      </section>
    } @else if (loading()) {
      <div class="flex flex-col gap-3">
        @for (row of [1, 2, 3]; track row) {
          <p-skeleton height="4rem" borderRadius="0.75rem" />
        }
      </div>
    } @else {
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        @for (item of items(); track item.id) {
          <li>
            <a
              class="flex flex-wrap items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 text-inherit no-underline transition-colors hover:border-primary"
              [routerLink]="baseUrl"
              [queryParams]="{ applicationId: item.id }"
            >
              <span class="min-w-0 flex-1 font-medium">{{ name(item.candidateId) }}</span>
              @if (item.registrationNumber) {
                <span class="text-sm text-surface-500">№ {{ item.registrationNumber }}</span>
              }
              <app-status-tag kind="application" [value]="item.status" />
              <i
                class="pi"
                aria-hidden="true"
                [class.pi-check-circle]="item.reporterReady"
                [class.text-green-600]="item.reporterReady"
                [class.pi-circle]="!item.reporterReady"
                [class.text-surface-400]="!item.reporterReady"
                [title]="(item.reporterReady ? 'staff-applications.ready.yes' : 'staff-applications.ready.no') | lang"
              ></i>
            </a>
          </li>
        } @empty {
          <li class="rounded-xl border border-surface-200 bg-surface-0 p-8 text-center text-surface-500">
            {{ 'staff-assessment.picker.empty' | lang }}
          </li>
        }
      </ul>
    }
  `,
})
export class AssessmentPickerComponent {
  private readonly api = inject(ContestApplicationApi);
  private readonly contestApi = inject(ContestApi);
  private readonly names = inject(CandidateNamesStore);
  private readonly session = inject(SessionService);

  protected readonly baseUrl = ASSESSMENT_URL;
  protected readonly contestId = signal<number | null>(null);
  protected readonly contests = signal<Contest[]>([]);
  protected readonly contestsLoading = signal(true);
  protected readonly items = signal<Application[]>([]);
  protected readonly loading = signal(false);
  private readonly candidateNames = computed(() => this.names.namesOf(this.items().map((item) => item.candidateId))());

  protected readonly contestOptions = computed(() =>
    this.contests()
      .filter((contest) => contest.id !== undefined)
      .map((contest) => ({ value: contest.id as number, label: contest.name || `#${contest.id}` })),
  );

  constructor() {
    this.contestApi
      .byStatus(['PUBLISHED', 'PENDING_DOCUMENT_REVIEW'], { size: 200, sort: 'createdAt,desc' })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (result) => {
          this.contests.set(result.content);
          this.contestsLoading.set(false);
        },
        error: () => this.contestsLoading.set(false),
      });
  }

  protected setContest(contestId: number | null): void {
    this.contestId.set(contestId);

    if (contestId === null) {
      this.items.set([]);

      return;
    }

    const request: Observable<Application[]> = this.session.can('BOARD')
      ? this.api
          .myReporting(contestId)
          .pipe(map((items) => items.filter((item) => item.status === 'PENDING_BOARD_REVIEW')))
      : this.api.byContest(contestId, ['PENDING_BOARD_REVIEW'], { size: 200 }).pipe(map((page) => page.content));

    this.loading.set(true);
    request.subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected name(candidateId: number | undefined): string {
    if (candidateId === undefined) return '—';

    const name = this.candidateNames().get(candidateId);

    return name === undefined ? '…' : name || `#${candidateId}`;
  }
}
