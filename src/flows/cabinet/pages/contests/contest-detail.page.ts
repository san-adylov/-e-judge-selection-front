import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { catchError, EMPTY, forkJoin, map, type Observable, of, Subject, switchMap } from 'rxjs';

import type { Schemas, VisibleStatus } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestBanMessageComponent } from '@features/contest-card/ban-message.component';
import {
  type CandidateContests,
  CandidateContestsLoader,
  type ContestCard,
} from '@features/contest-card/candidate-contests';
import { actionFor, NO_PARTICIPATION, type Participation, serverToday } from '@features/contest-card/contest-action';
import { ContestActionButtonComponent } from '@features/contest-card/contest-action-button.component';
import { ContestApplyService } from '@features/contest-card/contest-apply.service';
import { ContestProfileHintComponent } from '@features/contest-card/profile-hint.component';
import { ContestAnnouncementComponent } from '@features/contest-info/contest-announcement.component';
import { ContestRequirementsComponent } from '@features/contest-info/contest-requirements.component';
import { ContestScheduleComponent } from '@features/contest-info/contest-schedule.component';
import { skipErrorToast } from '@shared/api/http-context';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { SafeHtmlPipe } from '@shared/lib/safe-html.pipe';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

type Contest = Schemas['ContestResponse'];
type Step = Schemas['ContestStepResponse'];

/** Общие поля `ContestResponse` и `ContestCardResponse` + статус участия из карточки. */
type Summary = Pick<
  Contest,
  'id' | 'name' | 'status' | 'type' | 'vacantPlaces' | 'startDate' | 'documentAcceptanceEndDate'
> & {
  visibleStatus?: VisibleStatus;
};

/** `GET /contest/{id}`: `missing` — 404 (40413), остальные ошибки — сбой, который можно повторить. */
interface ContestResult {
  contest: Contest | null;
  missing: boolean;
}

interface Loaded {
  result: ContestResult;
  plan: Step[] | null;
  catalog: CandidateContests;
}

const TEXTS = [
  { key: 'description', field: 'description' },
  { key: 'note', field: 'note' },
  { key: 'additional-info', field: 'additionalInfo' },
] as const satisfies readonly { key: string; field: keyof Contest }[];

/**
 * Конкурс для кандидата (`/cabinet/contests/:id`): `GET /contest/{id}` и `/contest/steps/{id}` открыты любому
 * авторизованному, статус участия — только в `/contest/available`. Если полная карточка недоступна,
 * страница показывает данные строки списка.
 */
@Component({
  selector: 'app-contest-detail-page',
  imports: [
    RouterLink,
    LangPipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Message,
    Skeleton,
    LocalDatePipe,
    SafeHtmlPipe,
    StatusTagComponent,
    ContestActionButtonComponent,
    ContestAnnouncementComponent,
    ContestBanMessageComponent,
    ContestProfileHintComponent,
    ContestRequirementsComponent,
    ContestScheduleComponent,
  ],
  providers: [ContestApplyService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contest-detail.page.html',
})
export default class ContestDetailPage {
  private readonly contestApi = inject(ContestApi);
  private readonly loader = inject(CandidateContestsLoader);
  /** `null` — отменить текущую загрузку (неверный id). */
  private readonly requests = new Subject<{ id: number; initial: boolean } | null>();
  protected readonly flow = inject(ContestApplyService);

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly contest = signal<Contest | null>(null);
  protected readonly card = signal<ContestCard | null>(null);
  protected readonly plan = signal<Step[]>([]);
  /** Заявки кандидата; `null` — `/contest-application/my` не загрузился. */
  private readonly participation = signal<Participation | null>(null);
  /** Список `/contest/available` загружен (в нём `visibleStatus` конкурса). */
  private readonly cardsLoaded = signal(false);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  /** Конкурс не загрузился не из-за 404 — блок ошибки с «Повторить». */
  protected readonly failed = signal(false);

  /** Полная карточка недоступна — показаны данные из списка конкурсов. */
  protected readonly limited = computed(() => !this.contest() && !!this.card());
  /** Ни списка конкурсов, ни своих заявок: участие неизвестно, «Подать заявку» не предлагается. */
  protected readonly participationUnknown = computed(() => !this.cardsLoaded() && this.participation() === null);

  protected readonly summary = computed<Summary | null>(() => {
    const card = this.card();
    const source = this.contest() ?? card;

    if (!source) return null;

    const { id, name, status, type, vacantPlaces, startDate, documentAcceptanceEndDate } = source;

    return {
      id,
      name,
      status,
      type,
      vacantPlaces,
      startDate,
      documentAcceptanceEndDate,
      visibleStatus: card?.visibleStatus,
    };
  });

  protected readonly action = computed(() => {
    const summary = this.summary();

    if (!summary || this.participationUnknown()) return null;

    return actionFor(summary, {
      today: serverToday(),
      banned: this.flow.banned(),
      participation: this.participation() ?? NO_PARTICIPATION,
      refusedTypes: this.flow.refusedTypes(),
    });
  });

  protected readonly applicationId = computed(() => {
    const id = this.summary()?.id;

    return id === undefined ? null : this.participation()?.applicationIds.get(id);
  });

  /** Описание, примечание и доп. информация — HTML из редактора секретаря. */
  protected readonly texts = computed(() => {
    const contest = this.contest();

    return TEXTS.map(({ key, field }) => ({ key, html: contest?.[field]?.trim() ?? '' })).filter((text) => !!text.html);
  });

  constructor() {
    this.flow.loadBanStatus();

    // `switchMap`: ответ на прежний id или прежнюю загрузку не перезапишет новые данные.
    this.requests
      .pipe(
        switchMap((request) =>
          request ? this.fetch(request.id).pipe(map((loaded) => ({ ...request, loaded }))) : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ id, initial, loaded }) => this.show(id, initial, loaded));

    effect(() => {
      const id = this.id();

      untracked(() => this.load(id, true));
    });

    // Отказ 4091, 4102 или по срокам приёма: перечитываем без скелетона.
    this.flow.stale.pipe(takeUntilDestroyed()).subscribe(() => this.load(this.id(), false));
  }

  protected retry(): void {
    this.load(this.id(), true);
  }

  protected refresh(): void {
    this.load(this.id(), false);
  }

  private load(rawId: string, initial: boolean): void {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      this.requests.next(null);
      this.notFound.set(true);
      this.failed.set(false);
      this.loading.set(false);

      return;
    }

    if (initial) this.loading.set(true);

    this.requests.next({ id, initial });
  }

  private fetch(id: number): Observable<Loaded> {
    return forkJoin({
      result: this.contestApi.get(id, skipErrorToast()).pipe(
        map((contest): ContestResult => ({ contest, missing: false })),
        catchError((error: unknown) =>
          of<ContestResult>({ contest: null, missing: error instanceof HttpErrorResponse && error.status === 404 }),
        ),
      ),
      plan: this.contestApi.steps(id, skipErrorToast()).pipe(catchError(() => of(null))),
      catalog: this.loader.load(),
    });
  }

  /** При перечитывании (`initial = false`) то, что не загрузилось, остаётся прежним. */
  private show(id: number, initial: boolean, { result, plan, catalog }: Loaded): void {
    const keep = !initial;
    const contest = result.contest ?? (keep && !result.missing ? this.contest() : null);
    const card = catalog.cards ? (catalog.cards.find((item) => item.id === id) ?? null) : keep ? this.card() : null;

    this.contest.set(contest);
    this.card.set(card);
    this.plan.set(plan ?? contest?.steps ?? (keep ? this.plan() : []));
    this.participation.set(catalog.participation ?? (keep ? this.participation() : null));
    this.cardsLoaded.set(!!catalog.cards || (keep && this.cardsLoaded()));
    this.notFound.set(!contest && !card && result.missing);
    this.failed.set(!contest && !card && !result.missing);
    this.loading.set(false);
  }
}
