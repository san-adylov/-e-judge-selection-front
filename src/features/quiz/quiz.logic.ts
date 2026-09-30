import type { Schemas } from '@domain/api/api.types';
import type { StageExercise } from '@shared/auth/auth.models';

export type TestView = Schemas['TestViewResponse'];
export type QuizQuestion = Schemas['QuestionView'];
export type QuizOption = Schemas['OptionView'];
export type TestResult = Schemas['TestResultResponse'];
export type ChoiceType = NonNullable<QuizQuestion['choiceType']>;

/** Коды ошибок `TestSessionService` / `StageTokenGuard` (common/error/ErrorType.java). */
export const QUIZ_ERRORS = {
  ANSWER_ALREADY_SUBMITTED: 4116,
  ALREADY_FINISHED: 4118,
  NOT_FINISHED: 4119,
  TIME_LIMIT: 4133,
  STAGE_TOKEN_MISMATCH: 4318,
  TEST_NOT_FOUND: 40410,
} as const;

// ---------- Таймер: отсчёт и вид — @features/stage-timer ----------

/** Момент окончания по часам клиента: `remainingSeconds` сервера плюс время получения ответа. */
export function deadlineAt(remainingSeconds: number | undefined, receivedAt: number): number {
  return receivedAt + Math.max(0, remainingSeconds ?? 0) * 1000;
}

// ---------- Вопросы и навигация ----------

export interface PaletteItem {
  number: number;
  answered: boolean;
  current: boolean;
  /** Вариант выбран, но ещё не сохранён. */
  draft: boolean;
  saving: boolean;
  failed: boolean;
}

/** Вопросы по порядковому номеру `orderNumber` (бэкенд уже сортирует, но полагаться не на что). */
export function sortQuestions(questions: readonly QuizQuestion[] | undefined): QuizQuestion[] {
  return [...(questions ?? [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

export function unansweredNumbers(questions: readonly QuizQuestion[]): number[] {
  return questions.filter((question) => !question.answered).map((question) => question.number ?? 0);
}

/** Соседний вопрос в порядке номеров или `null` на краю. */
export function adjacentNumber(questions: readonly QuizQuestion[], current: number, step: 1 | -1): number | null {
  const index = questions.findIndex((question) => question.number === current);
  const next = index < 0 ? null : questions[index + step];

  return next?.number ?? null;
}

/** Первый неотвеченный вопрос после `after` (по кругу), кроме исключённых; `null`, если таких нет. */
export function nextUnanswered(
  questions: readonly QuizQuestion[],
  after: number,
  exclude: ReadonlySet<number> = new Set(),
): number | null {
  const open = questions.filter((question) => !question.answered && !exclude.has(question.number ?? 0));
  const later = open.find((question) => (question.number ?? 0) > after);

  return (later ?? open.find((question) => question.number !== after))?.number ?? null;
}

export function paletteItems(
  questions: readonly QuizQuestion[],
  current: number,
  drafts: ReadonlyMap<number, readonly number[]>,
  saving: ReadonlySet<number>,
  failed: ReadonlySet<number>,
): PaletteItem[] {
  return questions.map((question) => {
    const number = question.number ?? 0;
    const answered = !!question.answered;

    return {
      number,
      answered,
      current: number === current,
      draft: !answered && (drafts.get(number)?.length ?? 0) > 0,
      saving: saving.has(number),
      failed: !answered && failed.has(number),
    };
  });
}

/** Один вариант заменяет выбор, несколько — переключаются. */
export function toggleOption(
  choiceType: ChoiceType | undefined,
  selected: readonly number[],
  optionId: number,
): number[] {
  if (choiceType !== 'MULTIPLE') return [optionId];

  return selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId];
}

// ---------- Доступ по параметру маршрута ----------

export type QuizAccess = { kind: 'ok'; testId: number } | { kind: 'redirect' };

/**
 * `:testId` из URL → число. Токен этапа допускает только к своему упражнению (`StageTokenGuard`, 4318):
 * чужой или не тот тип — на `homeUrl`. Обычный токен кандидата бэкенд пускает к своему тесту.
 */
export function quizAccess(param: string | null | undefined, stage: StageExercise | null): QuizAccess {
  const testId = Number(param);

  if (!param || !Number.isSafeInteger(testId) || testId <= 0) return { kind: 'redirect' };
  if (stage && (stage.exerciseType !== 'TEST' || stage.exerciseId !== testId)) return { kind: 'redirect' };

  return { kind: 'ok', testId };
}

// ---------- Результат ----------

export interface ResultSummary {
  questionCount: number;
  /** `null` — бэкенд не вернул результат (тест не подсчитан). */
  correct: number | null;
  passing: number;
  /** Процент правильных, округлённый вниз, чтобы не завышать. */
  percent: number | null;
  passed: boolean | null;
}

export function resultSummary(result: TestResult): ResultSummary {
  const questionCount = result.questionCount ?? 0;
  const correct = result.correctAnswers ?? null;

  return {
    questionCount,
    correct,
    passing: result.passingCorrectAnswers ?? 0,
    percent: correct !== null && questionCount > 0 ? Math.floor((correct / questionCount) * 100) : null,
    passed: result.passed ?? null,
  };
}
