import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';

import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';

import {
  availableContests,
  type ContestCard,
  createJudgeApplicationForm,
  isFinalStatus,
  type JudgeApplication,
  judgeApplicationActions,
  judgeApplicationStages,
  type JudgeApplicationStatus,
  scoreTiles,
  statusHintSeverity,
  toDraftRequest,
  toFormValue,
} from './judge-application.model';

const ALL_STATUSES: JudgeApplicationStatus[] = [
  'DRAFT',
  'PENDING_SECRETARY_REVIEW',
  'REGISTERED',
  'PENDING_DOCUMENT_REVIEW',
  'REJECTED_AFTER_DOCUMENT_REVIEW',
  'APPROVED_AFTER_DOCUMENT_REVIEW',
  'PENDING_ASSESSMENT_APPROVAL',
  'REJECTED_ASSESSMENT_APPROVAL',
  'APPROVED_ASSESSMENT_APPROVAL',
  'PENDING_INTERVIEW',
  'REJECTED_AFTER_INTERVIEW',
  'APPROVED_AFTER_INTERVIEW',
];

describe('judgeApplicationActions', () => {
  it('allows editing and submitting only a draft', () => {
    expect(judgeApplicationActions('DRAFT')).toEqual({ edit: true, submit: true, scores: false });

    for (const status of ALL_STATUSES.filter((value) => value !== 'DRAFT')) {
      const actions = judgeApplicationActions(status);

      expect(actions.edit).toBe(false);
      expect(actions.submit).toBe(false);
    }
  });

  it('shows scores from registration on', () => {
    expect(judgeApplicationActions('PENDING_SECRETARY_REVIEW').scores).toBe(false);
    expect(judgeApplicationActions('REGISTERED').scores).toBe(true);
    expect(judgeApplicationActions('PENDING_INTERVIEW').scores).toBe(true);
    expect(judgeApplicationActions('REJECTED_AFTER_DOCUMENT_REVIEW').scores).toBe(true);
  });

  it('allows nothing without a status', () => {
    expect(judgeApplicationActions(undefined)).toEqual({ edit: false, submit: false, scores: false });
  });
});

describe('status helpers', () => {
  it('treats rejections and the interview approval as final', () => {
    expect(ALL_STATUSES.filter(isFinalStatus)).toEqual([
      'REJECTED_AFTER_DOCUMENT_REVIEW',
      'REJECTED_ASSESSMENT_APPROVAL',
      'REJECTED_AFTER_INTERVIEW',
      'APPROVED_AFTER_INTERVIEW',
    ]);
  });

  it('colours hints by outcome', () => {
    expect(statusHintSeverity('APPROVED_AFTER_INTERVIEW')).toBe('success');
    expect(statusHintSeverity('REJECTED_ASSESSMENT_APPROVAL')).toBe('error');
    expect(statusHintSeverity('APPROVED_AFTER_DOCUMENT_REVIEW')).toBe('info');
    expect(statusHintSeverity(undefined)).toBe('info');
  });
});

describe('judgeApplicationStages', () => {
  const states = (status: JudgeApplicationStatus) => judgeApplicationStages(status).map((stage) => stage.state);

  it('starts with the submission stage for a draft', () => {
    expect(states('DRAFT')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('completes the secretary stage on registration', () => {
    expect(states('REGISTERED')).toEqual(['done', 'done', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('marks the stage where the application was rejected', () => {
    expect(states('REJECTED_ASSESSMENT_APPROVAL')).toEqual(['done', 'done', 'done', 'rejected', 'upcoming']);
  });

  it('completes every stage after the interview approval', () => {
    expect(states('APPROVED_AFTER_INTERVIEW')).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('covers every backend status', () => {
    for (const status of ALL_STATUSES) {
      expect(judgeApplicationStages(status)).toHaveLength(5);
    }
  });
});

describe('availableContests', () => {
  const contests: ContestCard[] = [
    { id: 1, name: 'Открытый', status: 'PUBLISHED' },
    { id: 2, name: 'Уже подана заявка', status: 'PUBLISHED' },
    { id: 3, name: 'Приём закрыт', status: 'PENDING_DOCUMENT_REVIEW' },
  ];

  it('keeps published contests without an application of the judge', () => {
    expect(availableContests(contests, [{ id: 10, contestId: 2 }]).map((contest) => contest.id)).toEqual([1]);
  });
});

describe('form ↔ request mapping', () => {
  const application: JudgeApplication = {
    id: 7,
    contestId: 3,
    status: 'DRAFT',
    preferredLanguage: 'KG',
    email: 'judge@sot.kg',
    homePhone: '+996 555 000 000',
    homeAddress: 'Бишкек',
  };

  it('fills the form from an application with empty strings for missing fields', () => {
    expect(toFormValue(application)).toEqual({
      contestId: 3,
      preferredLanguage: 'KG',
      email: 'judge@sot.kg',
      homePhone: '+996 555 000 000',
      workPhone: '',
      homeAddress: 'Бишкек',
      contactInfo: '',
    });
  });

  it('builds a draft request with trimmed values and without empty ones', () => {
    expect(
      toDraftRequest({
        contestId: 3,
        preferredLanguage: 'RU',
        email: '  judge@sot.kg ',
        homePhone: '',
        workPhone: '   ',
        homeAddress: 'Бишкек',
        contactInfo: '',
      }),
    ).toEqual({
      contestId: 3,
      preferredLanguage: 'RU',
      email: 'judge@sot.kg',
      homePhone: undefined,
      workPhone: undefined,
      homeAddress: 'Бишкек',
      contactInfo: undefined,
    });
  });

  it('round-trips an application through the form', () => {
    const form = createJudgeApplicationForm(new FormBuilder());

    form.reset(toFormValue(application));

    expect(form.valid).toBe(true);
    expect(toDraftRequest(form.getRawValue())).toEqual({
      contestId: 3,
      preferredLanguage: 'KG',
      email: 'judge@sot.kg',
      homePhone: '+996 555 000 000',
      workPhone: undefined,
      homeAddress: 'Бишкек',
      contactInfo: undefined,
    });
  });

  it('requires a contest and validates the email and lengths', () => {
    const form = createJudgeApplicationForm(new FormBuilder(), 'KG');

    expect(form.controls.preferredLanguage.value).toBe('KG');
    expect(form.controls.contestId.hasError('required')).toBe(true);

    form.patchValue({ contestId: 1, email: 'not-an-email', homePhone: '1'.repeat(33) });

    expect(form.controls.email.hasError('email')).toBe(true);
    expect(form.controls.homePhone.hasError('maxlength')).toBe(true);
    expect(form.valid).toBe(false);
  });

  it('refuses a request without a contest', () => {
    expect(() => toDraftRequest({ ...toFormValue(application), contestId: null })).toThrow();
  });
});

describe('scoreTiles', () => {
  it('shows documents and professional scores, essay only when present', () => {
    expect(scoreTiles({ documentRawScore: 12.5, professionalScore: undefined })).toEqual([
      { key: 'documents', value: 12.5 },
      { key: 'professional', value: null },
    ]);
    expect(scoreTiles({ documentRawScore: 0, professionalScore: 30, essayScore: 8 }).map((tile) => tile.key)).toEqual([
      'documents',
      'professional',
      'essay',
    ]);
    expect(scoreTiles(null)).toEqual([]);
  });
});

describe('JudgeApplicationsApi.myOne', () => {
  let api: JudgeApplicationsApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(JudgeApplicationsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('finds the own application in GET /judge-applications/my', () => {
    let found: JudgeApplication | undefined;
    let missing: JudgeApplication | undefined = { id: -1 };

    api.myOne(2).subscribe((application) => (found = application));
    backend.expectOne('/v1/judge-applications/my').flush([{ id: 1 }, { id: 2, contestName: 'Конкурс' }]);

    api.myOne(5).subscribe((application) => (missing = application));
    backend.expectOne('/v1/judge-applications/my').flush([{ id: 1 }]);

    expect(found).toEqual({ id: 2, contestName: 'Конкурс' });
    expect(missing).toBeUndefined();
  });
});
