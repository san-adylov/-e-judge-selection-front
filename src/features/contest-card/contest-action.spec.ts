import { acceptanceState, contestAction, isParticipating, serverToday } from './contest-action';

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
  it('«Моя заявка», если заявка уже есть — независимо от сроков и отстранения', () => {
    expect(contestAction({ participating: true, acceptance: 'closed', banned: true })).toEqual({ kind: 'application' });
  });

  it('«Подать заявку» при открытом приёме без отстранения', () => {
    expect(contestAction({ participating: false, acceptance: 'open', banned: false })).toEqual({ kind: 'apply' });
  });

  it('недоступно вне окна приёма', () => {
    expect(contestAction({ participating: false, acceptance: 'not-started', banned: false })).toEqual({
      kind: 'unavailable',
      reason: 'not-started',
    });
    expect(contestAction({ participating: false, acceptance: 'closed', banned: false })).toEqual({
      kind: 'unavailable',
      reason: 'closed',
    });
  });

  it('недоступно при отстранении', () => {
    expect(contestAction({ participating: false, acceptance: 'open', banned: true })).toEqual({
      kind: 'unavailable',
      reason: 'banned',
    });
  });
});

describe('serverToday', () => {
  it('берёт дату по Бишкеку (UTC+6)', () => {
    expect(serverToday(new Date('2026-09-30T19:00:00Z'))).toBe('2026-10-01');
    expect(serverToday(new Date('2026-09-30T17:59:00Z'))).toBe('2026-09-30');
  });
});
