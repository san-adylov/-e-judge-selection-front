import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { catchError, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { EssayApi } from '@domain/api/essay.api';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { EssayReaderComponent } from './essay-reader.component';
import { myEssayScore, type Submission } from './essay-rules';

type Mode = 'queue' | 'all';
type Contest = Schemas['ContestResponse'];
type Progress = Schemas['ReviewerProgressResponse'];

const PAGE_SIZE = 20;

/**
 * Проверка эссе членами Совета (`/administrative/essay-review`): очередь непроверенных работ
 * (`GET /essay/reply`) или все сданные с оценками (`GET /essay/reply/all`), прогресс проверяющих и чтение работы.
 */
@Component({
  selector: 'app-essay-review-page',
  imports: [
    FormsModule,
    LangPipe,
    ServerDateTimePipe,

    Paginator,
    Select,
    SelectButton,
    Skeleton,
    PageHeaderComponent,
    EssayReaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './essay-review.page.html',
})
export default class EssayReviewPage {
  private readonly api = inject(EssayApi);
  private readonly contestApi = inject(ContestApi);
  private readonly session = inject(SessionService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly contestId = signal<number | null>(null);
  protected readonly mode = signal<Mode>('queue');
  protected readonly contests = signal<Contest[]>([]);
  protected readonly contestsLoading = signal(true);
  protected readonly items = signal<Submission[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = PAGE_SIZE;
  protected readonly progress = signal<Progress[]>([]);
  protected readonly readerOpen = signal(false);
  protected readonly cursor = signal(0);

  protected readonly contestOptions = computed(() =>
    this.contests()
      .filter((contest) => contest.id !== undefined)
      .map((contest) => ({ value: contest.id as number, label: contest.name || `#${contest.id}` })),
  );
  protected readonly modeOptions = computed(() => {
    this.lang.currentLang();

    return (['queue', 'all'] as const).map((value) => ({ value, label: this.lang.get(`staff-essay.mode.${value}`) }));
  });
  protected readonly current = computed(() => this.items()[this.cursor()] ?? null);
  protected readonly position = computed(() =>
    this.items().length ? { index: this.cursor() + 1, total: this.items().length } : null,
  );
  /** Моя оценка работы в списке — чтобы отметить уже проверенные в режиме «все». */
  protected readonly myScoreOf = computed(() => {
    const userId = this.session.user()?.id;

    return (submission: Submission) => myEssayScore(submission, userId);
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
  }

  protected setContest(contestId: number | null): void {
    this.contestId.set(contestId);
    this.load(0);
    this.loadProgress();
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.load(0);
  }

  protected onPage(state: PaginatorState): void {
    this.load(Math.floor((state.first ?? 0) / PAGE_SIZE));
  }

  protected open(index: number): void {
    this.cursor.set(index);
    this.readerOpen.set(true);
  }

  protected move(step: -1 | 1): void {
    this.cursor.update((cursor) => Math.min(Math.max(cursor + step, 0), this.items().length - 1));
  }

  /** Оценка сохранена: в очереди работа исчезает, в общем списке — обновляется; прогресс перечитывается. */
  protected onScored(submission: Submission): void {
    if (this.mode() === 'queue') {
      this.items.update((items) => items.filter((item) => item.id !== submission.id));
      this.total.update((total) => Math.max(0, total - 1));
      this.cursor.update((cursor) => Math.min(cursor, Math.max(0, this.items().length - 1)));
      if (!this.items().length) this.readerOpen.set(false);
    } else {
      this.items.update((items) => items.map((item) => (item.id === submission.id ? submission : item)));
    }

    this.loadProgress();
  }

  private load(page: number): void {
    const contestId = this.contestId();

    this.page.set(page);
    this.readerOpen.set(false);

    if (contestId === null) {
      this.items.set([]);
      this.total.set(0);

      return;
    }

    const query = { page, size: PAGE_SIZE };
    const request =
      this.mode() === 'queue' ? this.api.reviewQueue(contestId, query) : this.api.allReplies(contestId, query);

    this.loading.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.items.set(result.content);
        this.total.set(result.totalElements);
        this.cursor.set(0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadProgress(): void {
    const contestId = this.contestId();

    if (contestId === null) {
      this.progress.set([]);

      return;
    }

    this.api
      .progress(contestId)
      .pipe(
        catchError(() => of<Progress[]>([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((progress) => this.progress.set(progress));
  }
}
