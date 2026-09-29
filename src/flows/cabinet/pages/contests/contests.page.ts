import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';

import type { ContestType } from '@domain/api/api.types';
import { ContestBanMessageComponent } from '@features/contest-card/ban-message.component';
import { CandidateContestsLoader, type ContestCard } from '@features/contest-card/candidate-contests';
import { actionFor, NO_PARTICIPATION, serverToday } from '@features/contest-card/contest-action';
import { ContestApplyService } from '@features/contest-card/contest-apply.service';
import { ContestCardComponent } from '@features/contest-card/contest-card.component';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

const PAGE_SIZE = 12;
const CONTEST_TYPES: readonly ContestType[] = ['RESERVE', 'SUPREME_COURT', 'CONSTITUTIONAL_COURT'];

/**
 * Конкурсы для кандидата (`GET /v1/contest/available`): карточки со статусом участия `visibleStatus`.
 * Список загружается целиком (см. `CandidateContestsLoader`), фильтр по типу и страницы — на клиенте.
 */
@Component({
  selector: 'app-contests-page',
  imports: [
    FormsModule,
    LangPipe,
    Button,
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
    <div class="max-w-6xl">
      <app-page-header title="contests.title" subtitle="contests.subtitle">
        <p-select
          class="w-full tablet:w-72"
          optionLabel="label"
          optionValue="value"
          [options]="typeOptions()"
          [showClear]="true"
          [placeholder]="'contests.filter.all' | lang"
          [ariaLabel]="'contests.filter.label' | lang"
          [ngModel]="type()"
          (ngModelChange)="setType($event)"
        />
      </app-page-header>

      <div class="flex flex-col gap-4">
        @if (flow.ban(); as ban) {
          @if (ban.banned) {
            <app-contest-ban-message [ban]="ban" />
          }
        }

        @if (loading()) {
          <div class="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop-s:grid-cols-3">
            @for (row of [1, 2, 3]; track row) {
              <p-skeleton height="16rem" borderRadius="0.75rem" />
            }
          </div>
        } @else if (failed()) {
          <section
            class="flex flex-col items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 p-8 text-center"
          >
            <i class="pi pi-exclamation-circle text-4xl text-surface-400" aria-hidden="true"></i>
            <p class="m-0 font-medium">{{ 'contests.error' | lang }}</p>
            <p-button icon="pi pi-refresh" [label]="'contests.retry' | lang" (onClick)="load()" />
          </section>
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
                (apply)="flow.apply(card.contest)"
              />
            } @empty {
              <section
                class="col-span-full flex flex-col items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 p-8 text-center"
              >
                <i class="pi pi-megaphone text-4xl text-surface-400" aria-hidden="true"></i>
                <p class="m-0 font-medium">{{ (type() ? 'contests.empty-filtered' : 'contests.empty') | lang }}</p>
                @if (!type()) {
                  <p class="m-0 text-sm text-surface-500">{{ 'contests.empty-hint' | lang }}</p>
                }
              </section>
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
    </div>
  `,
})
export default class ContestsPage implements OnInit {
  private readonly loader = inject(CandidateContestsLoader);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly flow = inject(ContestApplyService);

  protected readonly pageSize = PAGE_SIZE;
  /** `observe` догружает словарь `status` и следит за языком: `p-select` берёт подпись для aria-label и поиска. */
  private readonly typeLabels = CONTEST_TYPES.map((value) => ({
    value,
    label: this.lang.observe(`status.contestType.${value}`),
  }));
  protected readonly typeOptions = computed(() =>
    this.typeLabels.map(({ value, label }) => ({ value, label: label() })),
  );
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly contests = signal<ContestCard[]>([]);
  protected readonly participation = signal(NO_PARTICIPATION);
  protected readonly type = signal<ContestType | null>(null);
  protected readonly page = signal(0);

  protected readonly filtered = computed(() => {
    const type = this.type();

    return type ? this.contests().filter((contest) => contest.type === type) : this.contests();
  });

  protected readonly cards = computed(() => {
    const context = {
      today: serverToday(),
      banned: this.flow.banned(),
      participation: this.participation(),
      refusedTypes: this.flow.refusedTypes(),
    };
    const start = this.page() * PAGE_SIZE;

    return this.filtered()
      .slice(start, start + PAGE_SIZE)
      .map((contest) => ({
        contest,
        applicationId: contest.id === undefined ? null : context.participation.applicationIds.get(contest.id),
        action: actionFor(contest, context),
      }));
  });

  constructor() {
    // Отказ 4091, 4102 или по срокам приёма: карточки должны показать актуальное действие.
    this.flow.stale.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

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

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.loader
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ cards, participation }) => {
        this.loading.set(false);

        if (!cards) {
          this.failed.set(true);

          return;
        }

        this.contests.set(cards);
        // Без своих заявок список остаётся рабочим: «Моя заявка» — по `visibleStatus`, 4102 проверит бэкенд.
        this.participation.set(participation ?? NO_PARTICIPATION);
        this.page.update((page) => Math.min(page, Math.max(0, Math.ceil(this.filtered().length / PAGE_SIZE) - 1)));
      });
  }
}
