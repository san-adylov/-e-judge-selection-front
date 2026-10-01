import { DEFAULT_STATUSES, staffApplicationActions } from './application-rules';

describe('staff application actions', () => {
  it('секретарь регистрирует и возвращает только заявку, ожидающую регистрации', () => {
    const actor = { roles: ['SECRETARY' as const], userId: 1 };

    expect(staffApplicationActions({ status: 'PENDING_SECRETARY_REVIEW' }, actor)).toMatchObject({
      register: true,
      returnForCorrection: true,
      reassign: false,
      ready: false,
      cancel: false,
    });
    expect(staffApplicationActions({ status: 'PENDING_BOARD_REVIEW' }, actor)).toMatchObject({
      register: false,
      returnForCorrection: false,
    });
  });

  it('председатель переназначает докладчика, пока заявка у Совета', () => {
    const chairman = { roles: ['CHAIRMAN' as const], userId: 1 };
    const vice = { roles: ['VICE_CHAIRMAN' as const], userId: 2 };

    expect(staffApplicationActions({ status: 'PENDING_BOARD_REVIEW' }, chairman).reassign).toBe(true);
    expect(staffApplicationActions({ status: 'PENDING_BOARD_REVIEW' }, vice).reassign).toBe(true);
    expect(staffApplicationActions({ status: 'APPROVED_AWAITING_TEST' }, chairman).reassign).toBe(false);
    expect(
      staffApplicationActions({ status: 'PENDING_BOARD_REVIEW' }, { roles: ['BOARD_MEMBER'], userId: 3 }).reassign,
    ).toBe(false);
  });

  it('готовность отмечает только свой докладчик', () => {
    const member = { roles: ['BOARD_MEMBER' as const], userId: 7 };

    expect(staffApplicationActions({ status: 'PENDING_BOARD_REVIEW', reporterId: 7 }, member).ready).toBe(true);
    expect(staffApplicationActions({ status: 'PENDING_BOARD_REVIEW', reporterId: 8 }, member).ready).toBe(false);
    expect(staffApplicationActions({ status: 'APPROVED_AWAITING_TEST', reporterId: 7 }, member).ready).toBe(false);
    expect(
      staffApplicationActions({ status: 'PENDING_BOARD_REVIEW', reporterId: 7 }, { roles: ['SECRETARY'], userId: 7 })
        .ready,
    ).toBe(false);
  });

  it('администратор отменяет черновик и заявку у секретаря', () => {
    const admin = { roles: ['ADMIN' as const], userId: 1 };

    expect(staffApplicationActions({ status: 'NEW' }, admin).cancel).toBe(true);
    expect(staffApplicationActions({ status: 'PENDING_SECRETARY_REVIEW' }, admin).cancel).toBe(true);
    expect(staffApplicationActions({ status: 'PENDING_BOARD_REVIEW' }, admin).cancel).toBe(false);
  });

  it('статусы по умолчанию — без черновиков', () => {
    expect(DEFAULT_STATUSES).not.toContain('NEW');
    expect(DEFAULT_STATUSES).toContain('PENDING_SECRETARY_REVIEW');
  });
});
