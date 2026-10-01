import type { Schemas } from '@domain/api/api.types';
import { ESSAY_MAX_SCORE } from '@features/rating/score-breakdown';

export type Submission = Schemas['EssaySubmissionResponse'];

export const ESSAY_REVIEW_URL = '/administrative/essay-review';

export interface EssayAnswer {
  /** Номер по порядку, с 1. */
  number: number;
  questionRu?: string;
  questionKg?: string;
  answer: string;
}

/** Подвопросы темы по `orderNumber` с ответами кандидата; без подвопросов — один ответ на тему. */
export function essayAnswers(submission: Submission): EssayAnswer[] {
  const questions = [...(submission.topic?.subQuestions ?? [])].sort(
    (a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0),
  );
  const answers = submission.answers ?? [];

  if (!questions.length) return [{ number: 1, answer: answers[0] ?? '' }];

  return questions.map((question, index) => ({
    number: index + 1,
    questionRu: question.questionRu,
    questionKg: question.questionKg,
    answer: answers[index] ?? '',
  }));
}

/** Оценка текущего проверяющего, если он уже оценил работу (`4005` при повторе). */
export function myEssayScore(submission: Submission, userId: number | undefined): number | null {
  const own = submission.scores?.find((score) => score.boardMemberId === userId);

  return own?.score ?? null;
}

/** Балл в диапазоне `[0; ESSAY_MAX_SCORE]` (`EssayReviewService.score`). */
export function isValidEssayScore(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= ESSAY_MAX_SCORE;
}
