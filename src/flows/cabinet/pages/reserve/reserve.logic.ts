import type { Schemas } from '@domain/api/api.types';
import { parseLocalDate } from '@shared/lib/dates';

export type Reserve = Schemas['ReserveResponse'];
export type ReserveStatus = NonNullable<Reserve['status']>;
type Contest = Schemas['ContestResponse'];
type RatingEntry = Schemas['RatingEntryResponse'];
type Vacancy = Schemas['VacancyResponse'];
type VacancyApplication = Schemas['VacancyApplicationResponse'];
type VacancyApplicationStatus = NonNullable<VacancyApplication['status']>;

/** Срок резерва подсвечивается, когда до окончания осталось столько дней или меньше. */
export const EXPIRY_WARN_DAYS = 30;

/** `ReserveStatus.FINAL`: позиция закрыта, срок резерва больше ни на что не влияет. */
const FINAL: ReadonlySet<ReserveStatus> = new Set(['EXCLUDED', 'APPOINTED', 'CONFIRMED']);

/** `ReserveStatus.ENGAGED`: позиция занята заявкой на вакансию. */
const ENGAGED: ReadonlySet<ReserveStatus> = new Set(['SUBMITTED', 'APPROVED', 'APPOINTED', 'CONFIRMED']);

/** `VacancyApplicationStatus.NOT_OCCUPYING`: заявка закрыта и место не занимает. */
const NOT_OCCUPYING: ReadonlySet<VacancyApplicationStatus> = new Set(['WITHDRAWN', 'REJECTED', 'RESERVE_EXPIRED']);

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReserveActions {
  /** `POST /candidate/reserve/{id}/confirm`: APPROVED → CONFIRMED (окончательно). */
  confirm: boolean;
  /** `POST /candidate/reserve/{id}/decline`: APPROVED → NOT_CONFIRMED → ACTIVE (возврат в резерв). */
  decline: boolean;
}

/** По `ReserveStateMachine` события CONFIRM и DECLINE допустимы только из APPROVED. */
export function reserveActions(status: Reserve['status']): ReserveActions {
  const approved = status === 'APPROVED';

  return { confirm: approved, decline: approved };
}

export interface ReserveExpiry {
  /** `soon` — осталось не больше {@link EXPIRY_WARN_DAYS} дней, `expired` — срок истёк, `plain` — без подсветки. */
  tone: 'plain' | 'soon' | 'expired';
  /** Дней до окончания срока (0 — истёк); `null` — срок не задан. */
  daysLeft: number | null;
}

/**
 * Состояние срока резерва. Как в `CandidateReserve.isExpired`, срок истекает в сам день `expiresAt`;
 * флаг `expired` бэкенда (по часам сервера) главнее. Для финальных статусов срок не подсвечивается.
 */
export function reserveExpiry(reserve: Pick<Reserve, 'expiresAt' | 'expired' | 'status'>, today: Date): ReserveExpiry {
  const date = parseLocalDate(reserve.expiresAt);

  if (!date) return { tone: 'plain', daysLeft: null };

  const daysLeft = Math.max(0, daysBetween(today, date));

  if (reserve.status && FINAL.has(reserve.status)) return { tone: 'plain', daysLeft };
  if (reserve.expired || daysLeft === 0) return { tone: 'expired', daysLeft: 0 };

  return { tone: daysLeft <= EXPIRY_WARN_DAYS ? 'soon' : 'plain', daysLeft };
}

/** Целых календарных дней от `from` до `to` (без учёта времени и перехода на летнее время). */
export function daysBetween(from: Date, to: Date): number {
  const utc = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

/**
 * Заявка на вакансию, связанная с позицией: только пока позиция занята (`ENGAGED`) и заявка не закрыта.
 * После отказа позиция снова ACTIVE, а одобренная заявка остаётся в истории — её не показываем.
 * `/vacancy-application/my` отсортирован по дате создания (новые первыми), берём первую подходящую.
 */
export function linkedOffer(reserve: Reserve, applications: readonly VacancyApplication[]): VacancyApplication | null {
  if (!reserve.status || !ENGAGED.has(reserve.status)) return null;

  return (
    applications.find(
      (application) =>
        application.reserveId === reserve.id && !!application.status && !NOT_OCCUPYING.has(application.status),
    ) ?? null
  );
}

export interface ReserveCard {
  reserve: Reserve;
  contestName: string | null;
  contestType: Contest['type'] | null;
  /** Место в рейтинге конкурса (`/contest-results/my`). */
  rank: number | null;
  actions: ReserveActions;
  expiry: ReserveExpiry;
  /** Предложение или согласие на вакансию по этой позиции. */
  offer: VacancyApplication | null;
  /** Название вакансии, если она есть среди доступных кандидату. */
  offerVacancyName: string | null;
  /** Опубликованные вакансии конкурса, на которые можно откликнуться из активного резерва. */
  availableVacancies: number;
}

export interface ReserveSources {
  reserves: readonly Reserve[];
  contests: ReadonlyMap<number, Contest>;
  ratings: readonly RatingEntry[];
  applications: readonly VacancyApplication[];
  vacancies: readonly Vacancy[];
}

/** Собирает карточки резерва из ответов нескольких API; порядок — как пришёл с бэкенда. */
export function buildReserveCards(sources: ReserveSources, today: Date): ReserveCard[] {
  return sources.reserves.map((reserve) => {
    const contest = reserve.contestId === undefined ? undefined : sources.contests.get(reserve.contestId);
    const rating = sources.ratings.find((entry) => entry.applicationId === reserve.applicationId);
    const expiry = reserveExpiry(reserve, today);
    const offer = linkedOffer(reserve, sources.applications);
    const selectable = reserve.status === 'ACTIVE' && reserve.passed !== false && expiry.tone !== 'expired';

    return {
      reserve,
      contestName: contest?.name ?? null,
      contestType: contest?.type ?? null,
      rank: rating?.rank ?? null,
      actions: reserveActions(reserve.status),
      expiry,
      offer,
      offerVacancyName: offer
        ? (sources.vacancies.find((vacancy) => vacancy.id === offer.vacancyId)?.name ?? null)
        : null,
      availableVacancies: selectable
        ? sources.vacancies.filter((vacancy) => vacancy.contestId === reserve.contestId).length
        : 0,
    };
  });
}

/** Уникальные id конкурсов для запроса карточек `GET /contest/{id}`. */
export function contestIdsOf(reserves: readonly Reserve[]): number[] {
  return [...new Set(reserves.map((reserve) => reserve.contestId).filter((id): id is number => id !== undefined))];
}
