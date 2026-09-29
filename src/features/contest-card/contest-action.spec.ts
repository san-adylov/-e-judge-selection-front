import type { ContestType } from '@domain/api/api.types';

import {
  acceptanceState,
  actionFor,
  contestAction,
  hasActiveInSameType,
  isParticipating,
  NO_PARTICIPATION,
  participationOf,
  serverToday,
  UNKNOWN_TYPE,
} from './contest-action';

describe('acceptanceState', () => {
  const published = { status: 'PUBLISHED' as const, startDate: '2026-09-01', documentAcceptanceEndDate: '2026-10-01' };

  it('открыт внутри окна приёма, включая день начала', () => {
    expect(acceptanceState(published, '2026-09-01')).toBe('open');
    expect(acceptanceState(published, '2026-09-30')).toBe('open');
  });

  it('не начат до даты начала', () => {
    expect(acceptanceState(published, '2026-08-31')).toBe('not-started');
  });

  it('закрыт в день окончания: бэкенд принимает строго до него', () => {
    expect(acceptanceState(published, '2026-10-01')).toBe('closed');
    expect(acceptanceState(published, '2026-12-01')).toBe('closed');
  });

  it('закрыт, если конкурс не в статусе PUBLISHED', () => {
    expect(acceptanceState({ ...published, status: 'PENDING_DOCUMENT_REVIEW' }, '2026-09-10')).toBe('closed');
    expect(acceptanceState({ ...published, status: 'COMPLETED' }, '2026-09-10')).toBe('closed');
    expect(acceptanceState({ startDate: '2026-09-01' }, '2026-09-10')).toBe('closed');
  });

  it('без дат опубликованный конкурс открыт — срок проверит бэкенд', () => {
    expect(acceptanceState({ status: 'PUBLISHED' }, '2026-09-10')).toBe('open');
  });
});

describe('isParticipating', () => {
  it('true для любого visibleStatus, кроме NO_APPLICATION', () => {
    expect(isParticipating('DRAFT')).toBe(true);
    expect(isParticipating('APPLY')).toBe(true);
    expect(isParticipating('NOT_APPLY')).toBe(true);
    expect(isParticipating('NO_APPLICATION')).toBe(false);
    expect(isParticipating(undefined)).toBe(false);
  });
});

describe('contestAction', () => {
  const open = { participating: false, acceptance: 'open' as const, banned: false };

  it('«Моя заявка», если заявка уже есть — независимо от сроков и отстранения', () => {
    expect(contestAction({ participating: true, acceptance: 'closed', banned: true, activeSameType: true })).toEqual({
      kind: 'application',
    });
  });

  it('«Подать заявку» при открытом приёме без ограничений', () => {
    expect(contestAction(open)).toEqual({ kind: 'apply' });
  });

  it('недоступно вне окна приёма', () => {
    expect(contestAction({ ...open, acceptance: 'not-started' })).toEqual({
      kind: 'unavailable',
      reason: 'not-started',
    });
    expect(contestAction({ ...open, acceptance: 'closed' })).toEqual({ kind: 'unavailable', reason: 'closed' });
  });

  it('отстранение проверяется первым, как в createDraft (4153)', () => {
    expect(contestAction({ ...open, banned: true })).toEqual({ kind: 'unavailable', reason: 'banned' });
    expect(contestAction({ ...open, banned: true, acceptance: 'closed' })).toEqual({
      kind: 'unavailable',
      reason: 'banned',
    });
  });

  it('недоступно при активной заявке на конкурс того же типа (4102)', () => {
    expect(contestAction({ ...open, activeSameType: true })).toEqual({
      kind: 'unavailable',
      reason: 'active-same-type',
    });
  });
});

describe('participationOf / hasActiveInSameType', () => {
  const types = new Map<number, ContestType | null>([
    [1, 'RESERVE'],
    [2, 'RESERVE'],
    [3, 'SUPREME_COURT'],
    [4, null],
    [5, null],
  ]);

  it('id заявки по конкурсу — для ссылки «Моя заявка»', () => {
    const participation = participationOf(
      [
        { id: 10, contestId: 1, status: 'NEW' },
        { id: 11, contestId: 3, status: 'WITHDRAWN_BY_CANDIDATE' },
        { id: 12, status: 'NEW' },
      ],
      types,
    );

    expect([...participation.applicationIds]).toEqual([
      [1, 10],
      [3, 11],
    ]);
  });

  it('активная заявка блокирует другие конкурсы того же типа, но не свой и не другие типы', () => {
    const participation = participationOf([{ id: 10, contestId: 1, status: 'PENDING_BOARD_REVIEW' }], types);

    expect(hasActiveInSameType({ id: 2, type: 'RESERVE' }, participation)).toBe(true);
    expect(hasActiveInSameType({ id: 1, type: 'RESERVE' }, participation)).toBe(false);
    expect(hasActiveInSameType({ id: 3, type: 'SUPREME_COURT' }, participation)).toBe(false);
  });

  it('финальные статусы не мешают подаче', () => {
    for (const status of ['REJECTED_BY_BOARD', 'APPROVED', 'WITHDRAWN_BY_CANDIDATE', 'CANCELLED'] as const) {
      const participation = participationOf([{ id: 10, contestId: 1, status }], types);

      expect(hasActiveInSameType({ id: 2, type: 'RESERVE' }, participation)).toBe(false);
    }
  });

  it('конкурсы без типа считаются одним типом', () => {
    const participation = participationOf([{ id: 10, contestId: 4, status: 'NEW' }], types);

    expect(hasActiveInSameType({ id: 5, type: undefined }, participation)).toBe(true);
    expect(hasActiveInSameType({ id: 2, type: 'RESERVE' }, participation)).toBe(false);
  });

  it('активная заявка на конкурс неизвестного типа блокирует все типы (4102 учитывает и отменённые конкурсы)', () => {
    const participation = participationOf([{ id: 10, contestId: 99, status: 'NEW' }], types);

    expect(participation.activeTypes.get(99)).toBe(UNKNOWN_TYPE);
    expect(hasActiveInSameType({ id: 2, type: 'RESERVE' }, participation)).toBe(true);
    expect(hasActiveInSameType({ id: 3, type: 'SUPREME_COURT' }, participation)).toBe(true);
    expect(hasActiveInSameType({ id: 99, type: 'RESERVE' }, participation)).toBe(false);
  });

  it('финальная заявка на неизвестный конкурс ничего не блокирует', () => {
    const participation = participationOf([{ id: 10, contestId: 99, status: 'CANCELLED' }], types);

    expect(participation.activeTypes.size).toBe(0);
    expect(participation.applicationIds.get(99)).toBe(10);
  });
});

describe('actionFor', () => {
  const today = '2026-09-10';
  const card = {
    id: 2,
    type: 'RESERVE' as const,
    status: 'PUBLISHED' as const,
    startDate: '2026-09-01',
    documentAcceptanceEndDate: '2026-10-01',
    visibleStatus: 'NO_APPLICATION' as const,
  };

  it('открытый конкурс без заявок — «Подать заявку»', () => {
    expect(actionFor(card, { today, banned: false, participation: NO_PARTICIPATION })).toEqual({ kind: 'apply' });
  });

  it('заявка из /my считается участием, даже если карточка устарела', () => {
    const participation = participationOf([{ id: 7, contestId: 2, status: 'NEW' }], new Map([[2, 'RESERVE']]));

    expect(actionFor(card, { today, banned: false, participation })).toEqual({ kind: 'application' });
  });

  it('активная заявка на другой конкурс того же типа', () => {
    const participation = participationOf(
      [{ id: 7, contestId: 1, status: 'APPROVED_AWAITING_TEST' }],
      new Map([
        [1, 'RESERVE'],
        [2, 'RESERVE'],
      ]),
    );

    expect(actionFor(card, { today, banned: false, participation })).toEqual({
      kind: 'unavailable',
      reason: 'active-same-type',
    });
  });

  it('после отказа 4102 по типу конкурсы этого типа больше не предлагают подачу', () => {
    const refusedTypes = new Set<ContestType | null>(['RESERVE']);
    const context = { today, banned: false, participation: NO_PARTICIPATION, refusedTypes };

    expect(actionFor(card, context)).toEqual({ kind: 'unavailable', reason: 'active-same-type' });
    expect(actionFor({ ...card, id: 3, type: 'SUPREME_COURT' }, context)).toEqual({ kind: 'apply' });
    expect(actionFor({ ...card, visibleStatus: 'DRAFT' }, context)).toEqual({ kind: 'application' });
  });
});

describe('serverToday', () => {
  it('берёт дату по Бишкеку (UTC+6)', () => {
    expect(serverToday(new Date('2026-09-30T19:00:00Z'))).toBe('2026-10-01');
    expect(serverToday(new Date('2026-09-30T17:59:00Z'))).toBe('2026-09-30');
  });
});
