/**
 * Проверки перед отправкой заявки. `error` блокирует отправку (то же отклонит бэкенд), `warn` — предупреждение:
 * перечень документов конкурса и ответы анкеты бэкенд при отправке не проверяет.
 * Подписи — `wizard.review.check.<key>.<state>` (параметр `count`).
 */
export type ReviewCheckKey = 'contacts' | 'dossier' | 'documents' | 'answers';
export type ReviewCheckState = 'ok' | 'warn' | 'error';

export interface ReviewCheck {
  key: ReviewCheckKey;
  state: ReviewCheckState;
  count: number;
  /** Шаг мастера, где исправляется пункт. */
  step: number;
}

export interface ReviewInput {
  contactsValid: boolean;
  dossierComplete: boolean;
  missingDocuments: number;
  unanswered: number;
}

/** Номера шагов мастера заявки. */
export const WIZARD_STEP = { contacts: 1, dossier: 2, answers: 3, documents: 4, review: 5 } as const;

export function reviewChecks(input: ReviewInput): ReviewCheck[] {
  return [
    { key: 'contacts', state: input.contactsValid ? 'ok' : 'error', count: 0, step: WIZARD_STEP.contacts },
    { key: 'dossier', state: input.dossierComplete ? 'ok' : 'error', count: 0, step: WIZARD_STEP.dossier },
    {
      key: 'answers',
      state: input.unanswered > 0 ? 'warn' : 'ok',
      count: input.unanswered,
      step: WIZARD_STEP.answers,
    },
    {
      key: 'documents',
      state: input.missingDocuments > 0 ? 'warn' : 'ok',
      count: input.missingDocuments,
      step: WIZARD_STEP.documents,
    },
  ];
}

export function sendBlocked(checks: readonly ReviewCheck[]): boolean {
  return checks.some((check) => check.state === 'error');
}
