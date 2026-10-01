import {
  draftFrom,
  draftTotal,
  emptyDraft,
  INTERVIEW_CRITERIA,
  isCompleteDraft,
  sortCandidates,
  toAssessmentRequest,
} from './interview-rules';

describe('interview rules', () => {
  it('draftFrom берёт только известные критерии', () => {
    const draft = draftFrom({ criteriaScores: { HONESTY: 7, UNKNOWN: 3 } });

    expect(draft.HONESTY).toBe(7);
    expect(draft.MOTIVATION).toBeNull();
    expect(Object.keys(draft)).toEqual([...INTERVIEW_CRITERIA]);
    expect(draftFrom(null)).toEqual(emptyDraft());
  });

  it('isCompleteDraft требует все восемь критериев в диапазоне 0..10', () => {
    const draft = emptyDraft();

    expect(isCompleteDraft(draft)).toBe(false);

    INTERVIEW_CRITERIA.forEach((key) => (draft[key] = 5));

    expect(isCompleteDraft(draft)).toBe(true);
    expect(draftTotal(draft)).toBe(40);

    draft.HONESTY = 11;

    expect(isCompleteDraft(draft)).toBe(false);
  });

  it('toAssessmentRequest пропускает пустые критерии', () => {
    const draft = emptyDraft();

    draft.HONESTY = 8;
    draft.MOTIVATION = 0;

    expect(toAssessmentRequest(draft)).toEqual({ criteriaScores: { HONESTY: 8, MOTIVATION: 0 } });
  });

  it('sortCandidates ставит открытых первыми, сохраняя порядок остальных', () => {
    const sorted = sortCandidates([
      { applicationId: 1, active: false },
      { applicationId: 2, active: true },
      { applicationId: 3, active: false },
    ]);

    expect(sorted.map((item) => item.applicationId)).toEqual([2, 1, 3]);
  });
});
