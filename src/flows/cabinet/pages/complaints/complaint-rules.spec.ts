import { FormControl } from '@angular/forms';

import {
  type Application,
  applicationLabel,
  bishkekDay,
  type Complaint,
  COMPLAINT_TEXT_MAX,
  documentStageDeadline,
  type EligibilityContext,
  eligibleComplaintTypes,
  lastRejectionByBoard,
  notBlank,
  parseComplaintType,
  parseId,
  presetFromQuery,
  toSubmitRequest,
} from './complaint-rules';

// 2026-09-28 12:00 по Бишкеку (UTC+6).
const NOW = new Date('2026-09-28T06:00:00Z');

function ctx(application: Application, overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return { application, contestStatus: 'PUBLISHED', history: [], complaints: [], now: NOW, ...overrides };
}

function rejectedAt(changedAt: string): EligibilityContext['history'] {
  return [
    { to: 'PENDING_BOARD_REVIEW', changedAt: '2026-09-01T10:00:00+06:00' },
    { from: 'PENDING_BOARD_REVIEW', to: 'REJECTED_BY_BOARD', changedAt },
  ];
}

describe('eligibleComplaintTypes', () => {
  it('allows nothing for an application in progress of an open contest', () => {
    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'PENDING_BOARD_REVIEW' }))).toEqual([]);
    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'APPROVED_AWAITING_TEST' }))).toEqual([]);
  });

  it('allows a document-stage complaint within 3 calendar days after the board rejection', () => {
    const application: Application = { id: 1, status: 'REJECTED_BY_BOARD' };

    // Отклонена 25.09 → последний день 28.09 включительно.
    expect(eligibleComplaintTypes(ctx(application, { history: rejectedAt('2026-09-25T23:30:00+06:00') }))).toEqual([
      'DOCUMENT_STAGE',
    ]);
    // Отклонена 24.09 → срок истёк 27.09.
    expect(eligibleComplaintTypes(ctx(application, { history: rejectedAt('2026-09-24T09:00:00+06:00') }))).toEqual([]);
  });

  it('counts the rejection day in Bishkek time, like the backend clock', () => {
    // 24.09 19:30 UTC = 25.09 01:30 по Бишкеку.
    const history = rejectedAt('2026-09-24T19:30:00Z');

    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'REJECTED_BY_BOARD' }, { history }))).toEqual([
      'DOCUMENT_STAGE',
    ]);
  });

  it('treats a rejection without history as today (backend fallback)', () => {
    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'REJECTED_BY_BOARD' }))).toEqual(['DOCUMENT_STAGE']);
  });

  it('allows a test-result complaint after a failed test without a deadline', () => {
    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'TEST_FAILED' }))).toEqual(['TEST_RESULT']);
    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'REJECTED_AFTER_TEST' }))).toEqual(['TEST_RESULT']);
    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'NO_SHOW_TEST' }))).toEqual([]);
  });

  it('allows a violation complaint only for a completed contest, whatever the application status', () => {
    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'APPROVED' }, { contestStatus: 'COMPLETED' }))).toEqual([
      'CONTEST_VIOLATION',
    ]);
    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'TEST_FAILED' }, { contestStatus: 'COMPLETED' }))).toEqual([
      'TEST_RESULT',
      'CONTEST_VIOLATION',
    ]);
    expect(eligibleComplaintTypes(ctx({ id: 1, status: 'APPROVED' }, { contestStatus: null }))).toEqual([]);
  });

  it('excludes types already filed for the same application only', () => {
    const complaints: Complaint[] = [
      { id: 10, applicationId: 1, type: 'TEST_RESULT' },
      { id: 11, applicationId: 2, type: 'CONTEST_VIOLATION' },
    ];

    expect(
      eligibleComplaintTypes(ctx({ id: 1, status: 'TEST_FAILED' }, { contestStatus: 'COMPLETED', complaints })),
    ).toEqual(['CONTEST_VIOLATION']);
  });
});

describe('document-stage deadline', () => {
  it('adds 3 calendar days to the Bishkek rejection day, across month ends', () => {
    expect(documentStageDeadline('2026-09-29T10:00:00+06:00', NOW)).toBe('2026-10-02');
    expect(documentStageDeadline(null, NOW)).toBe('2026-10-01');
    expect(bishkekDay(new Date('2026-09-28T18:30:00Z'))).toBe('2026-09-29');
  });

  it('takes the latest transition to REJECTED_BY_BOARD', () => {
    expect(
      lastRejectionByBoard([
        { to: 'REJECTED_BY_BOARD', changedAt: '2026-09-20T10:00:00+06:00' },
        { to: 'PENDING_BOARD_REVIEW', changedAt: '2026-09-22T10:00:00+06:00' },
        { to: 'REJECTED_BY_BOARD', changedAt: '2026-09-26T10:00:00+06:00' },
      ]),
    ).toBe('2026-09-26T10:00:00+06:00');
    expect(lastRejectionByBoard([])).toBeNull();
  });
});

describe('toSubmitRequest', () => {
  it('maps the form and trims the text like the backend', () => {
    expect(toSubmitRequest({ applicationId: 5, type: 'TEST_RESULT', text: '  Прошу пересмотреть  ' })).toEqual({
      applicationId: 5,
      type: 'TEST_RESULT',
      text: 'Прошу пересмотреть',
    });
  });

  it('rejects incomplete, blank or too long input', () => {
    expect(toSubmitRequest({ applicationId: null, type: 'TEST_RESULT', text: 'текст' })).toBeNull();
    expect(toSubmitRequest({ applicationId: 5, type: null, text: 'текст' })).toBeNull();
    expect(toSubmitRequest({ applicationId: 5, type: 'TEST_RESULT', text: '   ' })).toBeNull();
    expect(
      toSubmitRequest({ applicationId: 5, type: 'TEST_RESULT', text: 'x'.repeat(COMPLAINT_TEXT_MAX + 1) }),
    ).toBeNull();
  });
});

describe('query params and labels', () => {
  it('parses deep-link params', () => {
    expect(parseId('12')).toBe(12);
    expect(parseId('abc')).toBeNull();
    expect(parseId('0')).toBeNull();
    expect(parseId(undefined)).toBeNull();
    expect(parseComplaintType('TEST_RESULT')).toBe('TEST_RESULT');
    expect(parseComplaintType('test_result')).toBeNull();
    expect(presetFromQuery('12', 'TEST_RESULT')).toEqual({ applicationId: 12, type: 'TEST_RESULT' });
    expect(presetFromQuery('12', 'OTHER')).toEqual({ applicationId: 12, type: null });
    expect(presetFromQuery(undefined, 'TEST_RESULT')).toBeNull();
  });

  it('treats whitespace-only text as blank', () => {
    expect(notBlank(new FormControl('   ', { nonNullable: true }))).toEqual({ required: true });
    expect(notBlank(new FormControl(' текст ', { nonNullable: true }))).toBeNull();
  });

  it('builds the application label', () => {
    expect(applicationLabel({ id: 1, contestName: 'Конкурс', registrationNumber: 'R-7' })).toBe('Конкурс · № R-7');
    expect(applicationLabel({ id: 1, contestId: 3 })).toBe('#3');
    expect(applicationLabel(undefined, 4)).toBe('#4');
  });
});
