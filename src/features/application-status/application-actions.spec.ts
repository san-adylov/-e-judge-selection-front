import type { ApplicationStatus } from '@domain/api/api.types';

import {
  applicationActions,
  documentComplaintDeadline,
  FINAL_APPLICATION_STATUSES,
  stageDates,
  WITHDRAWABLE_STATUSES,
} from './application-actions';

const ALL: ApplicationStatus[] = [
  'NEW',
  'PENDING_SECRETARY_REVIEW',
  'RETURNED_FOR_CORRECTION',
  'PENDING_BOARD_REVIEW',
  'REJECTED_BY_BOARD',
  'APPROVED_AWAITING_TEST',
  'TEST_IN_PROGRESS',
  'TEST_FAILED',
  'NO_SHOW_TEST',
  'REJECTED_AFTER_TEST',
  'PENDING_ESSAY',
  'NO_SHOW_ESSAY',
  'PENDING_INTERVIEW',
  'APPROVED',
  'REJECTED_AFTER_INTERVIEW',
  'WITHDRAWN_BY_CANDIDATE',
  'CANCELLED',
];

describe('applicationActions', () => {
  it('редактировать и отправить можно только черновик и заявку на доработке', () => {
    const allowed = ALL.filter((status) => applicationActions(status).submit);

    expect(allowed).toEqual(['NEW', 'RETURNED_FOR_CORRECTION']);
    expect(ALL.filter((status) => applicationActions(status).edit)).toEqual(allowed);
  });

  it('отозвать можно любой нефинальный статус до собеседования включительно', () => {
    const allowed = ALL.filter((status) => applicationActions(status).withdraw);

    expect(allowed).toEqual([
      'NEW',
      'PENDING_SECRETARY_REVIEW',
      'RETURNED_FOR_CORRECTION',
      'PENDING_BOARD_REVIEW',
      'APPROVED_AWAITING_TEST',
      'TEST_IN_PROGRESS',
      'PENDING_ESSAY',
      'PENDING_INTERVIEW',
    ]);
  });

  it('финальные статусы не допускают действий, кроме жалобы', () => {
    for (const status of FINAL_APPLICATION_STATUSES) {
      const actions = applicationActions(status);

      expect(actions.final).toBe(true);
      expect(actions.edit || actions.submit || actions.withdraw).toBe(false);
      expect(WITHDRAWABLE_STATUSES.has(status)).toBe(false);
    }
  });

  it('жалоба: на документы после отклонения Советом, на тест после проваленного теста', () => {
    expect(applicationActions('REJECTED_BY_BOARD').complaint).toBe('DOCUMENT_STAGE');
    expect(applicationActions('TEST_FAILED').complaint).toBe('TEST_RESULT');
    expect(applicationActions('REJECTED_AFTER_TEST').complaint).toBe('TEST_RESULT');
    expect(ALL.filter((status) => applicationActions(status).complaint)).toHaveLength(3);
  });

  it('подсказка о коде этапа — на тестировании и письменном задании', () => {
    expect(applicationActions('APPROVED_AWAITING_TEST').stage).toBe('TESTING');
    expect(applicationActions('TEST_IN_PROGRESS').stage).toBe('TESTING');
    expect(applicationActions('PENDING_ESSAY').stage).toBe('ESSAY');
    expect(applicationActions('PENDING_INTERVIEW').stage).toBeNull();
  });

  it('без статуса действий нет', () => {
    expect(applicationActions(undefined)).toEqual({
      edit: false,
      submit: false,
      withdraw: false,
      complaint: null,
      stage: null,
      final: false,
    });
  });
});

describe('documentComplaintDeadline', () => {
  it('срок считается от даты последнего отклонения по Бишкеку', () => {
    const deadline = documentComplaintDeadline([
      { to: 'REJECTED_BY_BOARD', changedAt: '2026-08-01T10:00:00Z' },
      { to: 'PENDING_BOARD_REVIEW', changedAt: '2026-08-05T10:00:00Z' },
      // 20:00 UTC — уже 2 сентября в Бишкеке.
      { to: 'REJECTED_BY_BOARD', changedAt: '2026-09-01T20:00:00Z' },
    ]);

    expect(deadline).toEqual(new Date(2026, 8, 5));
  });

  it('без отклонения в истории — null', () => {
    expect(documentComplaintDeadline([{ to: 'PENDING_BOARD_REVIEW', changedAt: '2026-08-05T10:00:00Z' }])).toBeNull();
  });
});

describe('stageDates', () => {
  it('возвращает только назначенные этапы в порядке прохождения', () => {
    expect(stageDates({ interviewDate: '2026-10-10T09:00:00', testDate: '2026-10-01T10:00:00' })).toEqual([
      { stage: 'test', date: '2026-10-01T10:00:00' },
      { stage: 'interview', date: '2026-10-10T09:00:00' },
    ]);
  });
});
