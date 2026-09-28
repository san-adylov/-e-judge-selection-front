import type { Schemas } from '@domain/api/api.types';

type Question = Schemas['AdditionalInfoQuestionResponse'];
type Answer = Schemas['AdditionalInfoAnswerResponse'];
type AnswerRequest = Schemas['AdditionalInfoAnswerRequest'];

/** Ответ привязан ровно к одной заявке: кандидата или судьи (`AdditionalInfoAnswerRequest.isBoundToOneApplication`). */
export type AnswerBinding =
  { applicationId: number; judgeApplicationId?: never } | { judgeApplicationId: number; applicationId?: never };

export interface AnswerRow {
  questionId: number;
  question: Question;
  /** Сохранённый ответ по этой заявке, если есть. */
  answer: Answer | null;
}

export interface AnswerValue {
  answer: string;
  fileId: number | null;
}

/** Максимальная длина ответа — `@Size(max = 4000)`. */
export const ANSWER_MAX_LENGTH = 4000;

export function isBoundTo(answer: Answer, binding: AnswerBinding): boolean {
  return binding.applicationId !== undefined
    ? answer.applicationId === binding.applicationId
    : answer.judgeApplicationId === binding.judgeApplicationId;
}

/**
 * Активные вопросы по `sortOrder` и ответы на них по этой заявке. `GET /candidate/sections/ADDITIONAL_INFO`
 * возвращает ответы по всем заявкам кандидата — фильтруем по привязке; при дублях берём последний.
 */
export function answerRows(
  questions: readonly Question[],
  answers: readonly Answer[],
  binding: AnswerBinding,
): AnswerRow[] {
  const latest = new Map<number, Answer>();

  for (const answer of answers) {
    if (answer.questionId === undefined || !isBoundTo(answer, binding)) continue;

    const current = latest.get(answer.questionId);

    if (!current || (answer.id ?? 0) > (current.id ?? 0)) latest.set(answer.questionId, answer);
  }

  return questions
    .filter((question): question is Question & { id: number } => question.id !== undefined && question.active !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
    .map((question) => ({ questionId: question.id, question, answer: latest.get(question.id) ?? null }));
}

/** Тело создания/изменения ответа. Вопрос и заявка фиксируются при создании, при изменении бэкенд их не меняет. */
export function toAnswerRequest(binding: AnswerBinding, questionId: number, value: AnswerValue): AnswerRequest {
  const body: AnswerRequest = { questionId, answer: value.answer.trim() };

  if (binding.applicationId !== undefined) body.applicationId = binding.applicationId;
  else body.judgeApplicationId = binding.judgeApplicationId;

  if (value.fileId !== null) body.fileId = value.fileId;

  return body;
}

export function answerValue(answer: Answer | null): AnswerValue {
  return { answer: answer?.answer ?? '', fileId: answer?.fileId ?? null };
}

export function unansweredCount(rows: readonly AnswerRow[]): number {
  return rows.filter((row) => !row.answer?.answer?.trim()).length;
}
