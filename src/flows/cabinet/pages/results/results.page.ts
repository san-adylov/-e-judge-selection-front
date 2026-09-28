import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { catchError, forkJoin, map, type Observable, of, switchMap } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { ContestResultsApi } from '@domain/api/contest-results.api';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { ContestResultCardComponent } from './contest-result-card.component';
import { PassedContestsComponent } from './passed-contests.component';
import { contestIdsOf, type ResultsView, toResultsView } from './results.model';

/** Заявок кандидата на порядок меньше — одной страницы достаточно, чтобы найти конкурс по заявке. */
const APPLICATIONS_PAGE = { size: 100 };

/** Результаты кандидата: рейтинг по завершённым конкурсам (`/contest-results/my`) и пройденные конкурсы. */
@Component({
  selector: 'app-results-page',
  imports: [
    LangPipe,
    RouterLink,
    Button,
    Message,
    Skeleton,
    PageHeaderComponent,
    ContestResultCardComponent,
    PassedContestsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="results.title" subtitle="results.subtitle" />

    <div class="flex max-w-5xl flex-col gap-4">
      @if (loading()) {
        @for (row of [1, 2]; track row) {
          <div class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
            <p-skeleton width="60%" height="1.5rem" />
            <p-skeleton height="9rem" />
          </div>
        }
      } @else if (failed()) {
        <p-message severity="error">
          <div class="flex flex-wrap items-center gap-3">
            <span>{{ 'results.error.text' | lang }}</span>
            <p-button
              size="small"
              icon="pi pi-refresh"
              [text]="true"
              [label]="'results.error.retry' | lang"
              (onClick)="load()"
            />
          </div>
        </p-message>
      } @else if (empty()) {
        <section
          class="flex flex-col items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 px-4 py-10 text-center"
        >
          <i class="pi pi-chart-bar text-4xl text-surface-400" aria-hidden="true"></i>
          <h2 class="m-0 text-lg font-semibold">{{ 'results.empty.title' | lang }}</h2>
          <p class="m-0 max-w-md text-sm text-surface-500">{{ 'results.empty.text' | lang }}</p>
          <p-button icon="pi pi-list" routerLink="/cabinet/contests" [label]="'results.empty.action' | lang" />
        </section>
      } @else {
        @for (row of view().rows; track row.key) {
          <app-contest-result-card [row]="row" />
        }
        @if (view().passed.length) {
          <app-passed-contests [items]="view().passed" />
        }
      }
    </div>
  `,
})
export default class ResultsPage implements OnInit {
  private readonly results = inject(ContestResultsApi);
  private readonly applications = inject(ContestApplicationApi);
  private readonly contests = inject(ContestApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly view = signal<ResultsView>({ rows: [], passed: [] });
  protected readonly empty = computed(() => !this.view().rows.length && !this.view().passed.length);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      entries: this.results.my(),
      passed: this.results.completedMy(),
      // Без заявок рейтинг всё равно показываем — только без названия и типа конкурса.
      applications: this.applications.my(APPLICATIONS_PAGE).pipe(
        map((page) => page.content ?? []),
        catchError(() => of([])),
      ),
    })
      .pipe(
        switchMap(({ entries, passed, applications }) =>
          this.contestCards(contestIdsOf(entries, applications)).pipe(
            map((contests) => toResultsView(entries, passed, applications, contests)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (view) => {
          this.view.set(view);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  /** Карточки конкурсов для типа и даты завершения; недоступная карточка не ломает страницу. */
  private contestCards(ids: number[]): Observable<Schemas['ContestResponse'][]> {
    if (!ids.length) return of([]);

    return forkJoin(ids.map((id) => this.contests.get(id).pipe(catchError(() => of(null))))).pipe(
      map((cards) => cards.filter((card): card is Schemas['ContestResponse'] => card !== null)),
    );
  }
}
