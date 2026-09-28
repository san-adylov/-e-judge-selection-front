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
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { catchError, forkJoin, of } from 'rxjs';

import type { Schemas, VisibleStatus } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestBanMessageComponent } from '@features/contest-card/ban-message.component';
import { CandidateContestsLoader, type ContestCard } from '@features/contest-card/candidate-contests';
import { actionFor, NO_PARTICIPATION, serverToday } from '@features/contest-card/contest-action';
import { ContestActionButtonComponent } from '@features/contest-card/contest-action-button.component';
import { ContestApplyService } from '@features/contest-card/contest-apply.service';
import { ContestProfileHintComponent } from '@features/contest-card/profile-hint.component';
import { FileLinkComponent } from '@features/files/file-link.component';
import { skipErrorToast } from '@shared/api/http-context';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { SafeHtmlPipe } from '@shared/lib/safe-html.pipe';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { ContestRequirementsComponent } from './contest-requirements.component';
import { ContestScheduleComponent } from './contest-schedule.component';

type Contest = Schemas['ContestResponse'];
type Step = Schemas['ContestStepResponse'];

/** Общие поля `ContestResponse` и `ContestCardResponse` + статус участия из карточки. */
type Summary = Pick<
  Contest,
  'id' | 'name' | 'status' | 'type' | 'vacantPlaces' | 'startDate' | 'documentAcceptanceEndDate'
> & {
  visibleStatus?: VisibleStatus;
};

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
    Message,
    Skeleton,
    LocalDatePipe,
    SafeHtmlPipe,
    StatusTagComponent,
    FileLinkComponent,
    ContestActionButtonComponent,
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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly flow = inject(ContestApplyService);

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly contest = signal<Contest | null>(null);
  protected readonly card = signal<ContestCard | null>(null);
  protected readonly plan = signal<Step[]>([]);
  protected readonly participation = signal(NO_PARTICIPATION);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);

  /** Полная карточка недоступна — показаны данные из списка конкурсов. */
  protected readonly limited = computed(() => !this.contest() && !!this.card());

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

    return summary
      ? actionFor(summary, { today: serverToday(), banned: this.flow.banned(), participation: this.participation() })
      : null;
  });

  protected readonly applicationId = computed(() => {
    const id = this.summary()?.id;

    return id === undefined ? null : this.participation().applicationIds.get(id);
  });

  /** Описание, примечание и доп. информация — HTML из редактора секретаря. */
  protected readonly texts = computed(() => {
    const contest = this.contest();

    return TEXTS.map(({ key, field }) => ({ key, html: contest?.[field]?.trim() ?? '' })).filter((text) => !!text.html);
  });

  constructor() {
    this.flow.loadBanStatus();

    effect(() => {
      const id = this.id();

      untracked(() => this.load(id, true));
    });

    // Отказ 4091, 4102 или по срокам приёма: перечитываем без скелетона.
    this.flow.stale.pipe(takeUntilDestroyed()).subscribe(() => this.load(this.id(), false));
  }

  private load(rawId: string, initial: boolean): void {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      this.notFound.set(true);
      this.loading.set(false);

      return;
    }

    if (initial) this.loading.set(true);

    forkJoin({
      contest: this.contestApi.get(id, skipErrorToast()).pipe(catchError(() => of(null))),
      plan: this.contestApi.steps(id, skipErrorToast()).pipe(catchError(() => of(null))),
      catalog: this.loader.load().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ contest, plan, catalog }) => {
        const card = catalog?.cards.find((item) => item.id === id) ?? null;

        this.contest.set(contest);
        this.card.set(card);
        this.plan.set(plan ?? contest?.steps ?? []);
        this.participation.set(catalog?.participation ?? NO_PARTICIPATION);
        this.notFound.set(!contest && !card);
        this.loading.set(false);
      });
  }
}
