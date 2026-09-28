import type { Schemas } from '@domain/api/api.types';

import { contestIdsOf, toResultsView } from './results.model';

type Entry = Schemas['RatingEntryResponse'];

const ENTRIES: Entry[] = [
  { applicationId: 11, rank: 1, totalScore: 80, passed: true, reserveExpired: false },
  { applicationId: 12, rank: 9, totalScore: 30, passed: false, reserveExpired: false },
  { applicationId: 13, rank: 3, totalScore: 60, passed: true, reserveExpired: true },
];

const APPLICATIONS: Schemas['ApplicationResponse'][] = [
  { id: 11, contestId: 1, contestName: 'Конкурс 1 (из заявки)' },
  { id: 12, contestId: 2, contestName: 'Конкурс 2 (из заявки)' },
  { id: 13, contestId: 3, contestName: 'Конкурс 3 (из заявки)' },
];

const CONTESTS: Schemas['ContestResponse'][] = [
  { id: 1, name: 'Конкурс 1', type: 'RESERVE', completedAt: '2026-05-01T10:00:00' },
  { id: 2, name: 'Конкурс 2', type: 'SUPREME_COURT', completedAt: '2026-04-01T10:00:00' },
];

const PASSED: Schemas['PassedContestResponse'][] = [
  { contestId: 1, contestName: 'Конкурс 1', completedAt: '2026-05-01T10:00:00', rank: 1, totalScore: 80 },
  { contestId: 3, contestName: 'Конкурс 3', completedAt: '2025-01-10T10:00:00', rank: 3, totalScore: 60 },
];

describe('toResultsView', () => {
  it('связывает строку рейтинга с конкурсом через заявку, сохраняя порядок бэкенда', () => {
    const { rows } = toResultsView(ENTRIES, PASSED, APPLICATIONS, CONTESTS);

    expect(rows.map((row) => row.contestId)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ contestName: 'Конкурс 1', contestType: 'RESERVE', outcome: 'reserve' });
    expect(rows[1]).toMatchObject({ contestName: 'Конкурс 2', contestType: 'SUPREME_COURT', outcome: 'failed' });
  });

  it('без карточки конкурса — название из заявки, дата из пройденных конкурсов', () => {
    const { rows } = toResultsView(ENTRIES, PASSED, APPLICATIONS, CONTESTS);

    expect(rows[2]).toMatchObject({
      contestName: 'Конкурс 3 (из заявки)',
      contestType: null,
      completedAt: '2025-01-10T10:00:00',
      outcome: 'passed',
    });
  });

  it('без заявок строка остаётся, но без конкурса', () => {
    const { rows } = toResultsView(ENTRIES, [], [], []);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ contestId: null, contestName: null, contestType: null, completedAt: null });
  });

  it('ссылка на резерв — только если по конкурсу срок резерва ещё идёт', () => {
    const { passed } = toResultsView(ENTRIES, PASSED, APPLICATIONS, CONTESTS);

    expect(passed.map((item) => [item.contest.contestId, item.inReserve])).toEqual([
      [1, true],
      [3, false],
    ]);
  });

  it('пройденный конкурс без строки рейтинга не считается резервом', () => {
    const { passed } = toResultsView([], PASSED, [], []);

    expect(passed.every((item) => !item.inReserve)).toBe(true);
  });
});

describe('contestIdsOf', () => {
  it('уникальные конкурсы строк рейтинга, найденные по заявкам', () => {
    const entries: Entry[] = [...ENTRIES, { applicationId: 11 }, { applicationId: 99 }, {}];

    expect(contestIdsOf(entries, APPLICATIONS)).toEqual([1, 2, 3]);
  });
});
