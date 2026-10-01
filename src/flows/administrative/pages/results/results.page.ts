import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestResultsApi } from '@domain/api/contest-results.api';
import { DocumentsApi } from '@domain/api/documents.api';
import { RatingOutcomeTagComponent } from '@features/rating/rating-outcome-tag.component';
import {
  DEFAULT_SCORE_WEIGHTS,
  formatScore,
  type RatingEntry,
  type ScoreWeights,
} from '@features/rating/score-breakdown';
import { skipErrorToast } from '@shared/api/http-context';
import { saveBlob } from '@shared/lib/download';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

type Rating = Schemas['ContestRatingResponse'];
type Contest = Schemas['ContestResponse'];

/**
 * Рейтинг конкурса для сотрудников (`/administrative/results/:contestId`): `GET /contest-results/{id}/rating`
 * с разбивкой по этапам, проходным баллом и исходом; документ списка резерва (`POST /reserve-list`).
 */
@Component({
  selector: 'app-staff-results-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    ServerDateTimePipe,
    Button,
    Message,
    Skeleton,
    ToggleSwitch,
    StatusTagComponent,
    RatingOutcomeTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './results.page.html',
})
export default class StaffResultsPage {
  private readonly results = inject(ContestResultsApi);
  private readonly contests = inject(ContestApi);
  private readonly documents = inject(DocumentsApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  /** `:contestId` из маршрута. */
  readonly contestId = input.required<string>();

  protected readonly format = formatScore;
  protected readonly rating = signal<Rating | null>(null);
  protected readonly contest = signal<Contest | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly activeOnly = signal(false);
  protected readonly generating = signal(false);

  protected readonly id = computed(() => {
    const id = Number(this.contestId());

    return Number.isInteger(id) && id > 0 ? id : null;
  });
  protected readonly entries = computed<RatingEntry[]>(() => this.rating()?.entries ?? []);
  protected readonly weights = computed<ScoreWeights>(() => ({
    ...DEFAULT_SCORE_WEIGHTS,
    passing: this.rating()?.passingScore ?? DEFAULT_SCORE_WEIGHTS.passing,
  }));
  protected readonly passedCount = computed(() => this.entries().filter((entry) => entry.passed).length);

  constructor() {
    effect(() => {
      const id = this.id();

      this.activeOnly();
      untracked(() => this.load(id));
    });
  }

  protected retry(): void {
    this.load(this.id());
  }

  protected setActiveOnly(value: boolean): void {
    this.activeOnly.set(value);
  }

  /** Список резерва формируется бэкендом (`StoredFileRef`) и скачивается через `/documents/{id}/download`. */
  protected reserveList(): void {
    const id = this.id();

    if (id === null) return;

    this.generating.set(true);
    this.results
      .reserveList(id)
      .pipe(
        switchMap((file) => this.documents.download(file.id ?? 0)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.generating.set(false);
          saveBlob(response, `reserve-list-${id}.pdf`);
          this.notify.success(this.lang.get('staff-results.reserve-list.success'));
        },
        error: () => this.generating.set(false),
      });
  }

  private load(id: number | null): void {
    if (id === null) {
      this.failed.set(true);
      this.loading.set(false);

      return;
    }

    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      rating: this.results.rating(id, this.activeOnly()).pipe(catchError(() => of<Rating | null>(null))),
      contest: this.contests.get(id, skipErrorToast()).pipe(catchError(() => of<Contest | null>(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ rating, contest }) => {
        this.rating.set(rating);
        this.contest.set(contest);
        this.failed.set(rating === null);
        this.loading.set(false);
      });
  }
}
