import type { Schemas } from '@domain/api/api.types';

export type RatingEntry = Schemas['RatingEntryResponse'];

/** Составляющие итогового балла в порядке этапов конкурса (спецификация §14). */
export type ScorePartKey = 'documents' | 'test' | 'essay' | 'interview';

/** Вес каждой составляющей и проходной балл. */
export interface ScoreWeights {
  documents: number;
  test: number;
  essay: number;
  interview: number;
  passing: number;
}

/**
 * Значения по умолчанию `tandoo.scoring.*` (`ScoringProperties`): документы 10, тест 35, эссе 35, собеседование 20,
 * проходной балл 45. API кандидата весов не отдаёт; экраны Совета могут передать `passingScore` из
 * `ContestRatingResponse`.
 */
export const DEFAULT_SCORE_WEIGHTS: Readonly<ScoreWeights> = {
  documents: 10,
  test: 35,
  essay: 35,
  interview: 20,
  passing: 45,
};

export const SCORE_PARTS: readonly ScorePartKey[] = ['documents', 'test', 'essay', 'interview'];

/** Максимум оценки одного проверяющего за эссе (`tandoo.scoring.essayMaxScore`, по умолчанию 10). */
export const ESSAY_MAX_SCORE = 10;
/** Максимум балла по одному критерию собеседования (`tandoo.scoring.interviewMaxScore`, по умолчанию 10). */
export const INTERVIEW_MAX_SCORE = 10;

export interface ScorePart {
  key: ScorePartKey;
  /** Взвешенный балл составляющей (как пришёл с бэкенда, 0 — если этап не пройден или не проводился). */
  score: number;
  /** Вес составляющей — её максимум. */
  max: number;
  /** Доля от веса, 0–100 с одним знаком: ширина полосы. */
  percent: number;
}

export interface ScoreSummary {
  parts: ScorePart[];
  total: number;
  /** Максимум итога — сумма весов показанных составляющих. */
  max: number;
  percent: number;
  passing: number;
  /** Положение отметки проходного балла на полосе итога, 0–100. */
  passingPercent: number;
  passed: boolean;
}

/** Исход конкурса для кандидата: в резерве, прошёл (срок резерва истёк), не прошёл. */
export type RatingOutcome = 'reserve' | 'passed' | 'failed';

const SCORE_OF: Record<ScorePartKey, (entry: RatingEntry) => number | undefined> = {
  documents: (entry) => entry.documentScore,
  test: (entry) => entry.testScore,
  essay: (entry) => entry.essayScore,
  interview: (entry) => entry.interviewScore,
};

/** Доля `value` от `max` в процентах, зажатая в [0; 100], с одним знаком после запятой. */
export function percentOf(value: number, max: number): number {
  if (!(max > 0)) return 0;
  const ratio = Math.min(Math.max(value / max, 0), 1);

  return Math.round(ratio * 1000) / 10;
}

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Расшифровка итогового балла одной строки рейтинга. Показываются составляющие с положительным весом
 * (у действующего судьи набор тот же — отличается только максимум документов, уже учтённый бэкендом).
 * Итог и признак прохождения берутся с бэкенда, а не пересчитываются.
 */
export function scoreBreakdown(entry: RatingEntry, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): ScoreSummary {
  const parts = SCORE_PARTS.filter((key) => weights[key] > 0).map((key): ScorePart => {
    const score = num(SCORE_OF[key](entry));

    return { key, score, max: weights[key], percent: percentOf(score, weights[key]) };
  });
  const max = parts.reduce((sum, part) => sum + part.max, 0);
  const total = num(entry.totalScore);

  return {
    parts,
    total,
    max,
    percent: percentOf(total, max),
    passing: weights.passing,
    passingPercent: percentOf(weights.passing, max),
    passed: entry.passed === true,
  };
}

/** Прошедший кандидат остаётся в резерве, пока не истёк срок (`reserveExpired`, §15.3). */
export function ratingOutcome(entry: Pick<RatingEntry, 'passed' | 'reserveExpired'>): RatingOutcome {
  if (!entry.passed) return 'failed';

  return entry.reserveExpired ? 'passed' : 'reserve';
}

const SCORE_FORMAT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** Балл для показа: `27,5`, `45`. */
export function formatScore(value: number | null | undefined): string {
  return SCORE_FORMAT.format(num(value));
}
