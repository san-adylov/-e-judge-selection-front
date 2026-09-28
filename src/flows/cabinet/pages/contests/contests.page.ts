import { ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangPipe } from '@reforgium/presentia';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { catchError, forkJoin, of } from 'rxjs';

import type { ContestType, Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { ContestBanMessageComponent } from '@features/contest-card/ban-message.component';
import { acceptanceState, contestAction, isParticipating, serverToday } from '@features/contest-card/contest-action';
import { ContestApplyService } from '@features/contest-card/contest-apply.service';
import { ContestCardComponent } from '@features/contest-card/contest-card.component';
import { fetchAllPages } from '@features/contest-card/fetch-all';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

type Card = Schemas['ContestCardResponse'];

const PAGE_SIZE = 12;
const CONTEST_TYPES: readonly ContestType[] = ['RESERVE', 'SUPREME_COURT', 'CONSTITUTIONAL_COURT'];

/**
 * Конкурсы для кандидата (`GET /v1/contest/available`): карточки со статусом участия `visibleStatus`.
 * У эндпоинта нет фильтра по типу, поэтому список загружается целиком (конкурсов единицы–десятки),
 * фильтр и постраничный вывод — на клиенте.
 */
@Component({
  selector: 'app-contests-page',
  imports: [
    FormsModule,
    LangPipe,
    Paginator,
    Select,
    Skeleton,
    PageHeaderComponent,
    ContestBanMessageComponent,
    ContestCardComponent,
  ],
  providers: [ContestApplyService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="contests.title" subtitle="contests.subtitle">
      <p-select
        class="w-full tablet:w-72"
        optionLabel="label"
        optionValue="value"
        [options]="typeOptions"
        [showClear]="true"
        [placeholder]="'contests.filter.all' | lang"
        [ariaLabel]="'contests.filter.label' | lang"
        [ngModel]="type()"
        (ngModelChange)="setType($event)"
      >
        <ng-template #selectedItem let-option>{{ option.label | lang }}</ng-template>
        <ng-template #item let-option>{{ option.label | lang }}</ng-template>
      </p-select>
    </app-page-header>

    <div class="flex max-w-6xl flex-col gap-4">
      @if (flow.banned()) {
        <app-contest-ban-message [ban]="flow.ban()!" />
      }

      @if (loading()) {
        <div class="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop-s:grid-cols-3">
          @for (row of [1, 2, 3]; track row) {
            <div class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
              <p-skeleton height="12rem" />
            </div>
          }
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop-s:grid-cols-3">
          @for (card of cards(); track card.contest.id) {
            <app-contest-card
              [contest]="card.contest"
              [action]="card.action"
              [applicationId]="card.applicationId"
              [loading]="flow.pending() === card.contest.id"
              [disabled]="flow.pending() !== null"
              [profileHint]="flow.profileHint() === card.contest.id"
              (apply)="flow.apply(card.contest, reload)"
            />
          } @empty {
            <p
              class="col-span-full m-0 rounded-xl border border-surface-200 bg-surface-0 p-8 text-center text-surface-500"
            >
              {{ (type() ? 'contests.empty-filtered' : 'contests.empty') | lang }}
            </p>
          }
        </div>

        @if (filtered().length > pageSize) {
          <p-paginator
            [rows]="pageSize"
            [first]="page() * pageSize"
            [totalRecords]="filtered().length"
            (onPageChange)="onPage($event)"
          />
        }
      }
    </div>
  `,
})
export default class ContestsPage implements OnInit {
  private readonly contestApi = inject(ContestApi);
  private readonly applicationApi = inject(ContestApplicationApi);
  protected readonly flow = inject(ContestApplyService);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly typeOptions = CONTEST_TYPES.map((value) => ({ label: `status.contestType.${value}`, value }));
  protected readonly loading = signal(true);
  protected readonly contests = signal<Card[]>([]);
  /** id конкурса → id заявки кандидата: в карточке его нет, берётся из `GET /contest-application/my`. */
  protected readonly applicationIds = signal<ReadonlyMap<number, number>>(new Map());
  protected readonly type = signal<ContestType | null>(null);
  protected readonly page = signal(0);

  protected readonly filtered = computed(() => {
    const type = this.type();

    return type ? this.contests().filter((contest) => contest.type === type) : this.contests();
  });

  protected readonly cards = computed(() => {
    const today = serverToday();
    const banned = this.flow.banned();
    const ids = this.applicationIds();
    const start = this.page() * PAGE_SIZE;

    return this.filtered()
      .slice(start, start + PAGE_SIZE)
      .map((contest) => ({
        contest,
        applicationId: contest.id === undefined ? null : ids.get(contest.id),
        action: contestAction({
          participating: isParticipating(contest.visibleStatus),
          acceptance: acceptanceState(contest, today),
          banned,
        }),
      }));
  });

  /** Перезагрузка после 4091: заявка уже есть — карточка должна показать «Моя заявка». */
  protected readonly reload = () => this.load();

  ngOnInit(): void {
    this.flow.loadBanStatus();
    this.load();
  }

  protected setType(type: ContestType | null): void {
    this.type.set(type ?? null);
    this.page.set(0);
  }

  protected onPage(state: PaginatorState): void {
    this.page.set(Math.floor((state.first ?? 0) / PAGE_SIZE));
  }

  private load(): void {
    this.loading.set(true);

    forkJoin([
      fetchAllPages((query) => this.contestApi.available(query), { sort: 'id,desc' }),
      fetchAllPages((query) => this.applicationApi.my(query)).pipe(catchError(() => of([]))),
    ]).subscribe({
      next: ([contests, applications]) => {
        const ids = new Map<number, number>();

        for (const application of applications) {
          if (application.contestId !== undefined && application.id !== undefined) {
            ids.set(application.contestId, application.id);
          }
        }

        this.contests.set(contests);
        this.applicationIds.set(ids);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
