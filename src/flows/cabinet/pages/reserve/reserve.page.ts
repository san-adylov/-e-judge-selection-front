import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { catchError, forkJoin, map, type Observable, of, switchMap } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestResultsApi } from '@domain/api/contest-results.api';
import { ReserveApi } from '@domain/api/reserve.api';
import { VacanciesApi } from '@domain/api/vacancies.api';
import { NotifyService } from '@shared/ui/notify.service';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { buildReserveCards, contestIdsOf, type Reserve, type ReserveCard } from './reserve.logic';
import { ReserveCardComponent } from './reserve-card.component';

type Contest = Schemas['ContestResponse'];

/** Необязательные данные карточки: при ошибке карточка показывается без них (тост уже дал интерсептор). */
function optional<T>(source: Observable<T>, fallback: T): Observable<T> {
  return source.pipe(catchError(() => of(fallback)));
}

/** `/cabinet/reserve`: позиции кандидата в резерве, подтверждение готовности или отказ от должности. */
@Component({
  selector: 'app-reserve-page',
  imports: [RouterLink, LangPipe, Button, Skeleton, PageHeaderComponent, ReserveCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-5xl">
      <app-page-header title="reserve.title" subtitle="reserve.subtitle">
        <p-button
          icon="pi pi-refresh"
          severity="secondary"
          [outlined]="true"
          [label]="'reserve.actions.refresh' | lang"
          [loading]="loading()"
          (onClick)="load()"
        />
      </app-page-header>

      @if (loading() && !cards().length) {
        <div class="flex flex-col gap-4">
          @for (row of [1, 2]; track row) {
            <div class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
              <p-skeleton width="60%" height="1.5rem" />
              <div class="mt-4"><p-skeleton height="3rem" /></div>
            </div>
          }
        </div>
      } @else if (failed()) {
        <div class="rounded-xl border border-surface-200 bg-surface-0 p-8 text-center">
          <p class="m-0 text-surface-500">{{ 'reserve.error' | lang }}</p>
          <p-button
            styleClass="mt-4"
            icon="pi pi-refresh"
            [outlined]="true"
            [label]="'reserve.actions.retry' | lang"
            (onClick)="load()"
          />
        </div>
      } @else {
        <div class="flex flex-col gap-4">
          @for (card of cards(); track card.reserve.id) {
            <app-reserve-card
              [card]="card"
              [busy]="busyId() === card.reserve.id"
              (confirm)="confirm(card)"
              (decline)="decline(card)"
            />
          } @empty {
            <div class="rounded-xl border border-surface-200 bg-surface-0 p-6 text-center tablet:p-8">
              <i class="pi pi-users text-3xl text-surface-400"></i>
              <h2 class="m-0 mt-3 text-lg font-semibold">{{ 'reserve.empty.title' | lang }}</h2>
              <p class="m-0 mx-auto mt-2 max-w-xl text-sm text-surface-500">{{ 'reserve.empty.text' | lang }}</p>
              <a
                routerLink="/cabinet/results"
                class="mt-4 inline-flex items-center gap-2 font-medium text-primary hover:underline"
              >
                <i class="pi pi-chart-bar"></i>
                {{ 'reserve.actions.results' | lang }}
              </a>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export default class ReservePage implements OnInit {
  private readonly reserves = inject(ReserveApi);
  private readonly contests = inject(ContestApi);
  private readonly results = inject(ContestResultsApi);
  private readonly vacancies = inject(VacanciesApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cards = signal<ReserveCard[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  /** Позиция, по которой идёт подтверждение или отказ. */
  protected readonly busyId = signal<number | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.reserves
      .my()
      .pipe(
        switchMap((reserves) => (reserves.length ? this.withDetails(reserves) : of([]))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (cards) => {
          this.cards.set(cards);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  protected confirm(card: ReserveCard): void {
    this.ask(card, 'confirm', (id) => this.reserves.confirm(id), 'reserve.toast.confirmed');
  }

  protected decline(card: ReserveCard): void {
    this.ask(card, 'decline', (id) => this.reserves.decline(id), 'reserve.toast.declined');
  }

  private ask(
    card: ReserveCard,
    kind: 'confirm' | 'decline',
    action: (id: number) => Observable<Reserve>,
    toast: string,
  ): void {
    const id = card.reserve.id;

    if (id === undefined) return;

    const contest = card.contestName ?? this.lang.get('reserve.card.contest-fallback', { id: card.reserve.contestId });

    this.confirmation.confirm({
      header: this.lang.get(`reserve.${kind}-dialog.header`),
      message: this.lang.get(`reserve.${kind}-dialog.message`, { contest }),
      icon: kind === 'confirm' ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle',
      acceptLabel: this.lang.get(`reserve.${kind}-dialog.accept`),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      acceptButtonProps: { severity: kind === 'confirm' ? 'primary' : 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.busyId.set(id);
        action(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.busyId.set(null);
              this.notify.success(this.lang.get(toast));
              this.load();
            },
            error: () => this.busyId.set(null),
          });
      },
    });
  }

  /** Название и тип конкурса, место в рейтинге, заявки на вакансии и доступные вакансии. */
  private withDetails(reserves: Reserve[]): Observable<ReserveCard[]> {
    const contestIds = contestIdsOf(reserves);
    const contests = contestIds.length
      ? forkJoin(contestIds.map((id) => optional<Contest | null>(this.contests.get(id), null)))
      : of([]);

    return forkJoin({
      contests,
      ratings: optional(this.results.my(), []),
      applications: optional(this.vacancies.myApplications(), []),
      vacancies: optional(this.vacancies.available({ size: 100 }).pipe(map((page) => page.content)), []),
    }).pipe(
      map(({ contests: loaded, ratings, applications, vacancies }) =>
        buildReserveCards(
          {
            reserves,
            contests: new Map(
              loaded.filter((c): c is Contest => !!c?.id).map((contest) => [contest.id as number, contest]),
            ),
            ratings,
            applications,
            vacancies,
          },
          new Date(),
        ),
      ),
    );
  }
}
