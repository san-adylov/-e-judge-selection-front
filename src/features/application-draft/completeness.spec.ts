import { dossierComplete, dossierItems } from './completeness';
import { reviewChecks, sendBlocked } from './review-checks';

describe('dossier completeness', () => {
  it('reports every missing item like ProfileCompletenessService', () => {
    const snapshot = { profile: null, educationCount: 0, employmentCount: 2 };

    expect(dossierItems(snapshot)).toEqual([
      { key: 'PERSONAL_DATA', done: false },
      { key: 'PERSONAL_FILE', done: false },
      { key: 'EDUCATION', done: false },
      { key: 'EMPLOYMENT', done: true },
    ]);
    expect(dossierComplete(snapshot)).toBe(false);
  });

  it('requires the personal information file', () => {
    expect(dossierComplete({ profile: { id: 1 }, educationCount: 1, employmentCount: 1 })).toBe(false);
    expect(dossierComplete({ profile: { id: 1, fileId: 5 }, educationCount: 1, employmentCount: 1 })).toBe(true);
  });
});

describe('review checks', () => {
  it('blocks sending on invalid contacts or incomplete dossier only', () => {
    const warnings = reviewChecks({ contactsValid: true, dossierComplete: true, missingDocuments: 2, unanswered: 1 });

    expect(warnings.map((check) => [check.key, check.state, check.count])).toEqual([
      ['contacts', 'ok', 0],
      ['dossier', 'ok', 0],
      ['answers', 'warn', 1],
      ['documents', 'warn', 2],
    ]);
    expect(sendBlocked(warnings)).toBe(false);

    const errors = reviewChecks({ contactsValid: true, dossierComplete: false, missingDocuments: 0, unanswered: 0 });

    expect(errors.find((check) => check.key === 'dossier')).toMatchObject({ state: 'error', step: 2 });
    expect(sendBlocked(errors)).toBe(true);
  });
});
