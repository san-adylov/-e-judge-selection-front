import {
  type Confirmation,
  confirmationActions,
  confirmationView,
  courtNameOf,
  courtOptions,
  FILE_FIELDS,
  isRangeInvalid,
  missingForSubmit,
  toFormValue,
  toRequest,
} from './judge-confirmation.logic';

const FULL: Confirmation = {
  id: 7,
  status: 'CREATED',
  courtId: 3,
  courtName: 'Бишкекский городской суд',
  workExperienceFrom: '2015-03-01',
  workExperienceTo: '2024-12-31',
  decreeFileId: 11,
  assignmentFileId: 12,
  qualificationFileId: 13,
};

describe('judge confirmation: state → view and actions', () => {
  it('maps every backend status to a view', () => {
    expect(confirmationView(null)).toBe('intro');
    expect(confirmationView({})).toBe('intro');
    expect(confirmationView({ status: 'CREATED' })).toBe('draft');
    expect(confirmationView({ status: 'PENDING_SECRETARY_REVIEW' })).toBe('pending');
    expect(confirmationView({ status: 'UNDER_REVIEW' })).toBe('pending');
    expect(confirmationView({ status: 'APPROVED' })).toBe('approved');
    expect(confirmationView({ status: 'REJECTED' })).toBe('rejected');
  });

  it('opens the form only without a request or for the CREATED draft', () => {
    expect(confirmationActions('intro')).toEqual({ edit: true, startNew: false });
    expect(confirmationActions('draft')).toEqual({ edit: true, startNew: false });
    expect(confirmationActions('pending')).toEqual({ edit: false, startNew: false });
  });

  it('allows a new request once the latest one is final (APPROVED / REJECTED)', () => {
    expect(confirmationActions('approved')).toEqual({ edit: false, startNew: true });
    expect(confirmationActions('rejected')).toEqual({ edit: false, startNew: true });
  });
});

describe('judge confirmation: form ↔ request', () => {
  it('fills the form from a saved request, dates as local Date', () => {
    const value = toFormValue(FULL);

    expect(value.courtId).toBe(3);
    expect(value.workExperienceFrom).toEqual(new Date(2015, 2, 1));
    expect(value.workExperienceTo).toEqual(new Date(2024, 11, 31));
    expect([value.decreeFileId, value.assignmentFileId, value.qualificationFileId]).toEqual([11, 12, 13]);
  });

  it('starts with an empty form without a source', () => {
    expect(toFormValue(null)).toEqual({
      courtId: null,
      workExperienceFrom: null,
      workExperienceTo: null,
      decreeFileId: null,
      assignmentFileId: null,
      qualificationFileId: null,
    });
  });

  it('builds JudgeConfirmationRequest with yyyy-MM-dd dates and the court label', () => {
    expect(toRequest(toFormValue(FULL), 'Бишкекский городской суд')).toEqual({
      courtId: 3,
      courtName: 'Бишкекский городской суд',
      workExperienceFrom: '2015-03-01',
      workExperienceTo: '2024-12-31',
      decreeFileId: 11,
      assignmentFileId: 12,
      qualificationFileId: 13,
    });
  });

  it('omits empty fields and the court name without a court (draft may be partial)', () => {
    const value = { ...toFormValue(null), decreeFileId: 5 };

    expect(toRequest(value, 'не используется')).toEqual({ decreeFileId: 5 });
  });

  it('trims courtName to the backend limit of 500 characters', () => {
    const request = toRequest({ ...toFormValue(null), courtId: 1 }, 'x'.repeat(600));

    expect(request.courtName).toHaveLength(500);
  });

  it('uses the three judge file categories', () => {
    expect(FILE_FIELDS.map((field) => [field.key, field.category])).toEqual([
      ['decreeFileId', 'JUDGE_DECREE'],
      ['assignmentFileId', 'JUDGE_ASSIGNMENT'],
      ['qualificationFileId', 'JUDGE_QUALIFICATION'],
    ]);
  });
});

describe('judge confirmation: court options', () => {
  const options = [
    { label: 'Суд 1', value: 1 },
    { label: 'Суд 2', value: 2 },
  ];

  it('keeps an inactive saved court selectable by its saved name', () => {
    expect(courtOptions(options, { courtId: 9, courtName: 'Старый суд' })).toEqual([
      ...options,
      { label: 'Старый суд', value: 9 },
    ]);
    expect(courtOptions(options, { courtId: 2, courtName: 'Суд 2' })).toBe(options);
    expect(courtOptions(options, null)).toBe(options);
  });

  it('takes the court name from the directory, otherwise from the saved request', () => {
    expect(courtNameOf(2, options, null)).toBe('Суд 2');
    expect(courtNameOf(9, options, { courtId: 9, courtName: 'Старый суд' })).toBe('Старый суд');
    expect(courtNameOf(9, options, { courtId: 3, courtName: 'Другой' })).toBeNull();
    expect(courtNameOf(null, options, FULL)).toBeNull();
  });
});

describe('judge confirmation: submit readiness', () => {
  it('lists missing fields and passes a complete form', () => {
    expect(missingForSubmit(toFormValue(FULL))).toEqual([]);
    expect(missingForSubmit({ ...toFormValue(FULL), courtId: null, qualificationFileId: null })).toEqual([
      'courtId',
      'qualificationFileId',
    ]);
  });

  it('rejects an experience period that ends before it starts', () => {
    expect(isRangeInvalid(new Date(2020, 0, 2), new Date(2020, 0, 1))).toBe(true);
    expect(isRangeInvalid(new Date(2020, 0, 1), new Date(2020, 0, 1))).toBe(false);
    expect(isRangeInvalid(null, new Date(2020, 0, 1))).toBe(false);
  });
});
