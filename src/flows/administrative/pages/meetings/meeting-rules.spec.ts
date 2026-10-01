import { agendaSubjectId, decisionActions, decisionSignContext, meetingActions, subjectKind } from './meeting-rules';

describe('meeting rules', () => {
  it('subjectKind и agendaSubjectId по типу заседания', () => {
    expect(subjectKind('OPEN_COMPETITION')).toBe('CONTEST_AGENDA');
    expect(subjectKind('DOCUMENT_REVIEW')).toBe('APPLICATION');
    expect(subjectKind('COMPLAINT_REVIEW')).toBe('COMPLAINT');
    expect(subjectKind('JUDGE_INTERVIEW')).toBe('JUDGE_APPLICATION');
    expect(subjectKind('CREATE_VACANCY')).toBe('VACANCY_AGENDA');
    expect(subjectKind('CANDIDATE_APPROVAL')).toBe('VACANCY_APPLICATION');
    expect(subjectKind(undefined)).toBeNull();

    expect(agendaSubjectId({ type: 'CLOSE_COMPETITION', contestId: 5 })).toBe(5);
    expect(agendaSubjectId({ type: 'CREATE_VACANCY', vacancyId: 9 })).toBe(9);
    expect(agendaSubjectId({ type: 'DOCUMENT_REVIEW', contestId: 5 })).toBeNull();
  });

  it('действия над заседанием по роли, статусу и участию', () => {
    const meeting = { type: 'COMPLAINT_REVIEW' as const, status: 'OPENED' as const, participants: [{ userId: 1 }] };
    const member = { roles: ['BOARD_MEMBER' as const], userId: 1 };
    const outsider = { roles: ['BOARD_MEMBER' as const], userId: 2 };
    const secretary = { roles: ['SECRETARY' as const], userId: 3 };

    expect(meetingActions(meeting, member)).toEqual({ join: false, forceClose: true, reschedule: false, vote: true });
    expect(meetingActions(meeting, outsider)).toEqual({ join: true, forceClose: true, reschedule: false, vote: false });
    expect(meetingActions(meeting, secretary)).toEqual({
      join: true,
      forceClose: false,
      reschedule: false,
      vote: false,
    });
    expect(meetingActions({ ...meeting, type: 'DOCUMENT_REVIEW' }, member).forceClose).toBe(false);
    expect(meetingActions({ ...meeting, status: 'APPROVED' }, { roles: ['CHAIRMAN'], userId: 7 })).toEqual({
      join: false,
      forceClose: false,
      reschedule: false,
      vote: false,
    });
    expect(meetingActions({ ...meeting, status: 'APPOINTED' }, { roles: ['CHAIRMAN'], userId: 7 }).reschedule).toBe(
      true,
    );
  });

  it('действия над решением по статусу', () => {
    expect(decisionActions({ status: 'PENDING' }, ['SECRETARY'])).toEqual({
      generate: true,
      confirm: false,
      sign: false,
      download: false,
    });
    expect(decisionActions({ status: 'GENERATED', fileId: 4 }, ['CHAIRMAN'])).toEqual({
      generate: false,
      confirm: true,
      sign: true,
      download: true,
    });
    expect(decisionActions({ status: 'SIGNED', fileId: 4 }, ['BOARD_MEMBER']).sign).toBe(false);
    expect(decisionActions({ status: 'CONFIRMED', fileId: 4 }, ['ADMIN']).sign).toBe(false);
  });

  it('контекст подписи решения', () => {
    expect(decisionSignContext({ meetingId: 1, applicationId: 2 })).toEqual({
      meetingId: 1,
      applicationId: 2,
      judgeApplicationId: undefined,
    });
    expect(decisionSignContext({ meetingId: 1 })).toEqual({
      meetingId: 1,
      applicationId: undefined,
      judgeApplicationId: undefined,
    });
  });
});
