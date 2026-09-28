import {
  DEFAULT_SCORE_WEIGHTS,
  formatScore,
  percentOf,
  type RatingEntry,
  ratingOutcome,
  scoreBreakdown,
} from './score-breakdown';

const ENTRY: RatingEntry = {
  rank: 2,
  applicationId: 7,
  documentScore: 8.33,
  testScore: 27.5,
  essayScore: 24.5,
  interviewScore: 16,
  totalScore: 76.33,
  passed: true,
  reserveExpired: false,
};

describe('scoreBreakdown', () => {
  it('показывает четыре составляющие в порядке этапов с долей от веса', () => {
    const summary = scoreBreakdown(ENTRY);

    expect(summary.parts.map((part) => part.key)).toEqual(['documents', 'test', 'essay', 'interview']);
    expect(summary.parts.map((part) => part.max)).toEqual([10, 35, 35, 20]);
    expect(summary.parts.map((part) => part.percent)).toEqual([83.3, 78.6, 70, 80]);
  });

  it('итог — с бэкенда, максимум — сумма весов, отметка проходного балла на 45 %', () => {
    const summary = scoreBreakdown(ENTRY);

    expect(summary.total).toBe(76.33);
    expect(summary.max).toBe(100);
    expect(summary.percent).toBe(76.3);
    expect(summary.passing).toBe(45);
    expect(summary.passingPercent).toBe(45);
    expect(summary.passed).toBe(true);
  });

  it('отсутствующие баллы считаются нулём, а не ломают расчёт', () => {
    const summary = scoreBreakdown({ documentScore: 5, passed: false });

    expect(summary.parts.map((part) => part.score)).toEqual([5, 0, 0, 0]);
    expect(summary.parts.map((part) => part.percent)).toEqual([50, 0, 0, 0]);
    expect(summary.total).toBe(0);
    expect(summary.passed).toBe(false);
  });

  it('составляющая с нулевым весом не показывается, максимум пересчитывается', () => {
    const summary = scoreBreakdown(ENTRY, { ...DEFAULT_SCORE_WEIGHTS, essay: 0, passing: 30 });

    expect(summary.parts.map((part) => part.key)).toEqual(['documents', 'test', 'interview']);
    expect(summary.max).toBe(65);
    expect(summary.passingPercent).toBe(46.2);
  });

  it('полоса не выходит за 100 % и не бывает отрицательной', () => {
    const summary = scoreBreakdown({ documentScore: 12, testScore: -1, totalScore: 120 });

    expect(summary.parts[0].percent).toBe(100);
    expect(summary.parts[1].percent).toBe(0);
    expect(summary.percent).toBe(100);
  });
});

describe('percentOf', () => {
  it('нулевой или отрицательный максимум даёт 0', () => {
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(5, -10)).toBe(0);
  });
});

describe('ratingOutcome', () => {
  it('прошёл и срок не истёк — в резерве', () => {
    expect(ratingOutcome({ passed: true, reserveExpired: false })).toBe('reserve');
    expect(ratingOutcome({ passed: true })).toBe('reserve');
  });

  it('прошёл, срок резерва истёк', () => {
    expect(ratingOutcome({ passed: true, reserveExpired: true })).toBe('passed');
  });

  it('не прошёл — независимо от признака резерва', () => {
    expect(ratingOutcome({ passed: false, reserveExpired: false })).toBe('failed');
    expect(ratingOutcome({})).toBe('failed');
  });
});

describe('formatScore', () => {
  it('русская запятая, до двух знаков, пустое — 0', () => {
    expect(formatScore(27.5)).toBe('27,5');
    expect(formatScore(76.333)).toBe('76,33');
    expect(formatScore(45)).toBe('45');
    expect(formatScore(undefined)).toBe('0');
  });
});
