import type { TestResult } from '@features/quiz/quiz.logic';

type Translate = (key: string, params?: Record<string, number>) => string;

/** Состояние навигации на страницу результата (`history.state`): результат уже получен от `finish`. */
export interface QuizResultState {
  testId: number;
  /** `null` — `finish`/`result` не ответили, страница результата запросит его сама. */
  quizResult: TestResult | null;
  /** Тест завершён по истечении времени. */
  timeUp: boolean;
}

export interface FinishCounts {
  unanswered: number;
  total: number;
  /** Выбрано, но не сохранено: такие ответы не засчитываются. */
  drafts: number;
}

/** Текст подтверждения завершения: сколько вопросов без ответа и что станет с несохранёнными. */
export function finishConfirmMessage(counts: FinishCounts, t: Translate): string {
  const main = counts.unanswered
    ? t('quiz.finish.confirm-unanswered', { count: counts.unanswered, total: counts.total })
    : t('quiz.finish.confirm-all');

  return counts.drafts ? `${main} ${t('quiz.finish.confirm-drafts', { count: counts.drafts })}` : main;
}

/** Состояние из `history.state`, если оно относится к этому тесту; иначе `null` — результат грузится с сервера. */
export function resultStateFor(state: unknown, testId: number): QuizResultState | null {
  if (!state || typeof state !== 'object') return null;

  const candidate = state as Partial<QuizResultState>;

  if (candidate.testId !== testId || !('quizResult' in candidate)) return null;

  return { testId, quizResult: candidate.quizResult ?? null, timeUp: !!candidate.timeUp };
}
