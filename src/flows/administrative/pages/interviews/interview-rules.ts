import type { Schemas } from '@domain/api/api.types';
import { INTERVIEW_MAX_SCORE } from '@features/rating/score-breakdown';

export type InterviewCandidate = Schemas['InterviewCandidateResponse'];
export type Assessment = Schemas['InterviewAssessmentResponse'];

export const INTERVIEWS_URL = '/administrative/interviews';

/** Критерии собеседования в порядке `InterviewCriteria.java`; подписи — `staff-interviews.criteria.<KEY>`. */
export const INTERVIEW_CRITERIA = [
  'GENERAL_AWARENESS',
  'PROFESSIONAL_AWARENESS',
  'HONESTY',
  'OBJECTIVITY',
  'CONFLICT_BEHAVIOUR',
  'MOTIVATION',
  'PROFESSIONAL_DEVELOPMENT',
  'ORGANISATION',
] as const;

export type InterviewCriterion = (typeof INTERVIEW_CRITERIA)[number];

export type CriteriaDraft = Record<InterviewCriterion, number | null>;

export function emptyDraft(): CriteriaDraft {
  return Object.fromEntries(INTERVIEW_CRITERIA.map((key) => [key, null])) as CriteriaDraft;
}

/** Черновик из сохранённых оценок (`GET /interviews/my`); неизвестные ключи игнорируются. */
export function draftFrom(assessment: Assessment | null): CriteriaDraft {
  const draft = emptyDraft();

  for (const key of INTERVIEW_CRITERIA) {
    const value = assessment?.criteriaScores?.[key];

    if (typeof value === 'number') draft[key] = value;
  }

  return draft;
}

/** Все критерии заполнены и в диапазоне `[0; INTERVIEW_MAX_SCORE]` (`InterviewAssessmentService.validate`). */
export function isCompleteDraft(draft: CriteriaDraft): boolean {
  return INTERVIEW_CRITERIA.every((key) => {
    const value = draft[key];

    return value !== null && Number.isFinite(value) && value >= 0 && value <= INTERVIEW_MAX_SCORE;
  });
}

export function toAssessmentRequest(draft: CriteriaDraft): Schemas['InterviewAssessmentRequest'] {
  const criteriaScores: Record<string, number> = {};

  for (const key of INTERVIEW_CRITERIA) {
    const value = draft[key];

    if (value !== null) criteriaScores[key] = value;
  }

  return { criteriaScores };
}

export function draftTotal(draft: CriteriaDraft): number {
  return INTERVIEW_CRITERIA.reduce((sum, key) => sum + (draft[key] ?? 0), 0);
}

/** Кандидаты собеседования: открытые председателем — первыми, остальные — в порядке бэкенда. */
export function sortCandidates(candidates: readonly InterviewCandidate[]): InterviewCandidate[] {
  return [...candidates].sort((a, b) => Number(b.active ?? false) - Number(a.active ?? false));
}
