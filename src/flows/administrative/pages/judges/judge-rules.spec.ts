import { confirmationActions, judgeActions, nextJudgeMeeting } from './judge-rules';

describe('judge rules', () => {
  it('следующее заседание трека судьи по статусу', () => {
    expect(nextJudgeMeeting('REGISTERED')).toBe('JUDGE_DOCUMENT_REVIEW');
    expect(nextJudgeMeeting('APPROVED_AFTER_DOCUMENT_REVIEW')).toBe('PROFESSIONAL_ASSESSMENT_APPROVAL');
    expect(nextJudgeMeeting('APPROVED_ASSESSMENT_APPROVAL')).toBe('JUDGE_INTERVIEW');
    expect(nextJudgeMeeting('PENDING_INTERVIEW')).toBeNull();
    expect(nextJudgeMeeting('DRAFT')).toBeNull();
  });

  it('действия по роли и статусу', () => {
    const secretary = { roles: ['SECRETARY' as const], userId: 1 };
    const reporter = { roles: ['BOARD_MEMBER' as const], userId: 5 };
    const chairman = { roles: ['CHAIRMAN' as const], userId: 9 };

    expect(judgeActions({ status: 'PENDING_SECRETARY_REVIEW' }, secretary).register).toBe(true);
    expect(judgeActions({ status: 'REGISTERED' }, secretary).register).toBe(false);
    expect(judgeActions({ status: 'PENDING_INTERVIEW' }, secretary).invite).toBe(true);
    expect(judgeActions({ status: 'REGISTERED', reporterId: 5 }, reporter)).toMatchObject({
      ready: true,
      documentScore: true,
      professionalScore: true,
      scheduleMeeting: 'JUDGE_DOCUMENT_REVIEW',
      reassign: false,
    });
    expect(judgeActions({ status: 'REGISTERED', reporterId: 6 }, reporter).ready).toBe(false);
    expect(judgeActions({ status: 'REGISTERED', reporterId: 6 }, chairman).reassign).toBe(true);
    expect(judgeActions({ status: 'APPROVED_AFTER_INTERVIEW', reporterId: 5 }, reporter)).toMatchObject({
      ready: false,
      documentScore: false,
      professionalScore: false,
      scheduleMeeting: null,
    });
  });

  it('подтверждение статуса: взять в работу, затем решить', () => {
    expect(confirmationActions('PENDING_SECRETARY_REVIEW', ['SECRETARY'])).toEqual({ review: true, decide: false });
    expect(confirmationActions('UNDER_REVIEW', ['SECRETARY'])).toEqual({ review: false, decide: true });
    expect(confirmationActions('UNDER_REVIEW', ['CHAIRMAN'])).toEqual({ review: false, decide: false });
  });
});
