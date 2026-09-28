import type { ContestType, Schemas } from '@domain/api/api.types';
import { type RatingEntry, type RatingOutcome, ratingOutcome } from '@features/rating/score-breakdown';

type Application = Schemas['ApplicationResponse'];
type Contest = Schemas['ContestResponse'];
type PassedContest = Schemas['PassedContestResponse'];

/** Результат кандидата по одному конкурсу: строка рейтинга + сведения о конкурсе. */
export interface ContestResultRow {
  /** Ключ для `track`: заявка уникальна в пределах кандидата. */
  key: string;
  entry: RatingEntry;
  contestId: number | null;
  contestName: string | null;
  contestType: ContestType | null;
  completedAt: string | null;
  outcome: RatingOutcome;
}

/** Пройденный конкурс и признак «ещё в резерве» — для ссылки на `/cabinet/reserve`. */
export interface PassedContestRow {
  key: string;
  contest: PassedContest;
  inReserve: boolean;
}

export interface ResultsView {
  rows: ContestResultRow[];
  passed: PassedContestRow[];
}

function byId<T>(items: readonly T[], id: (item: T) => number | undefined): Map<number, T> {
  const map = new Map<number, T>();

  for (const item of items) {
    const key = id(item);

    if (key !== undefined) map.set(key, item);
  }

  return map;
}

/**
 * `RatingEntryResponse` не содержит конкурса — связываем строку с конкурсом через заявку (`applicationId` →
 * `ApplicationResponse.contestId`), тип и дату завершения берём из карточки конкурса. Порядок строк — как с бэкенда
 * (новые конкурсы первыми).
 */
export function toResultsView(
  entries: readonly RatingEntry[],
  passed: readonly PassedContest[],
  applications: readonly Application[],
  contests: readonly Contest[],
): ResultsView {
  const applicationById = byId(applications, (item) => item.id);
  const contestById = byId(contests, (item) => item.id);
  const passedById = byId(passed, (item) => item.contestId);

  const rows = entries.map((entry, index): ContestResultRow => {
    const application = entry.applicationId === undefined ? undefined : applicationById.get(entry.applicationId);
    const contestId = application?.contestId ?? null;
    const contest = contestId === null ? undefined : contestById.get(contestId);
    const passedContest = contestId === null ? undefined : passedById.get(contestId);

    return {
      key: `${entry.applicationId ?? 'row'}-${index}`,
      entry,
      contestId,
      contestName: contest?.name ?? application?.contestName ?? passedContest?.contestName ?? null,
      contestType: contest?.type ?? null,
      completedAt: contest?.completedAt ?? passedContest?.completedAt ?? null,
      outcome: ratingOutcome(entry),
    };
  });

  const outcomeByContest = new Map<number, RatingOutcome>();

  for (const row of rows) {
    if (row.contestId !== null) outcomeByContest.set(row.contestId, row.outcome);
  }

  return {
    rows,
    passed: passed.map((contest, index) => ({
      key: `${contest.contestId ?? 'contest'}-${index}`,
      contest,
      inReserve: contest.contestId !== undefined && outcomeByContest.get(contest.contestId) === 'reserve',
    })),
  };
}

/** Конкурсы строк рейтинга: их карточки нужны для типа и даты завершения. */
export function contestIdsOf(entries: readonly RatingEntry[], applications: readonly Application[]): number[] {
  const applicationById = byId(applications, (item) => item.id);
  const ids = new Set<number>();

  for (const entry of entries) {
    const contestId =
      entry.applicationId === undefined ? undefined : applicationById.get(entry.applicationId)?.contestId;

    if (contestId !== undefined) ids.add(contestId);
  }

  return [...ids];
}
