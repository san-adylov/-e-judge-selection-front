import {
  canCancel,
  canEdit,
  canPublish,
  isFinal,
  isPendingMeeting,
  missingForPublication,
  nextStageMeeting,
} from './contest-rules';

describe('contest rules', () => {
  it('конечные статусы закрывают редактирование, публикацию и отмену', () => {
    expect(isFinal('COMPLETED')).toBe(true);
    expect(isFinal('CANCELLED')).toBe(true);
    expect(isFinal('PUBLISHED')).toBe(false);
    expect(isFinal(undefined)).toBe(false);

    expect(canEdit('CREATED')).toBe(true);
    expect(canEdit('COMPLETED')).toBe(false);
    expect(canEdit(undefined)).toBe(false);

    expect(canCancel('PENDING_CLOSURE')).toBe(true);
    expect(canCancel('CANCELLED')).toBe(false);
  });

  it('публикация — только из READY_TO_PUBLISH', () => {
    expect(canPublish('READY_TO_PUBLISH')).toBe(true);
    expect(canPublish('CREATED')).toBe(false);
    expect(canPublish('PUBLISHED')).toBe(false);
  });

  it('следующее заседание этапа по таблице переходов', () => {
    expect(nextStageMeeting('CREATED')).toBe('OPEN_COMPETITION');
    expect(nextStageMeeting('PUBLISHED')).toBe('DOCUMENT_REVIEW');
    expect(nextStageMeeting('DOCUMENT_REVIEW_APPROVED')).toBe('CALENDAR_APPROVAL');
    expect(nextStageMeeting('CALENDAR_APPROVED')).toBe('INTERVIEW');
    expect(nextStageMeeting('INTERVIEW_COMPLETED')).toBe('CLOSE_COMPETITION');
    expect(nextStageMeeting('PENDING_OPENING')).toBeNull();
    expect(nextStageMeeting('READY_TO_PUBLISH')).toBeNull();
    expect(nextStageMeeting('COMPLETED')).toBeNull();

    expect(isPendingMeeting('PENDING_INTERVIEW')).toBe(true);
    expect(isPendingMeeting('PUBLISHED')).toBe(false);
  });

  it('missingForPublication повторяет проверку бэкенда', () => {
    expect(missingForPublication({})).toEqual([
      'startDate',
      'documentAcceptanceEndDate',
      'vacantPlaces',
      'type',
      'questionCategories',
    ]);
    expect(
      missingForPublication({
        startDate: '2026-10-01',
        documentAcceptanceEndDate: '2026-10-31',
        vacantPlaces: 0,
        type: 'RESERVE',
        questionCategories: [{ categoryId: 1, questionCount: 10 }],
      }),
    ).toEqual(['vacantPlaces']);
    expect(
      missingForPublication({
        startDate: '2026-10-01',
        documentAcceptanceEndDate: '2026-10-31',
        vacantPlaces: 3,
        type: 'RESERVE',
        questionCategories: [{ categoryId: 1, questionCount: 10 }],
      }),
    ).toEqual([]);
  });
});
