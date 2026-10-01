import type { AssessmentSection, Schemas } from '@domain/api/api.types';

type Summary = Schemas['AssessmentSummaryResponse'];
type Score = Schemas['SectionScoreResponse'];

export const ASSESSMENT_URL = '/administrative/document-assessment';

/** Разделы оценки в порядке `AssessmentSection.java`. */
export const ASSESSMENT_SECTIONS: readonly AssessmentSection[] = [
  'IMPECCABILITY',
  'DOCUMENTS',
  'ADDITIONAL_LOAD',
  'TAX_DECLARATION',
  'QUALIFICATION_CLASS',
  'ACADEMIC_DEGREE',
  'CERTIFICATES',
  'EDUCATION',
  'JUDGE_WORK_QUALITY_1',
  'JUDGE_WORK_QUALITY_2',
  'EMPLOYMENT',
  'PERSONAL_DATA',
  'AWARDS',
  'RELATIVES',
  'ASSETS',
  'ADDITIONAL_QUESTIONS',
  'OTHER',
];

export interface ScoreRow {
  section: AssessmentSection;
  maxScore: number;
  /** Выставленный балл докладчика; `null` — раздел ещё не оценён. */
  score: number | null;
  updatedAt?: string;
}

/**
 * Строки оценки: разделы из сводки (`GET /document-assessment/summary`, только оцениваемые для кандидата —
 * `maxScore > 0`) с баллами из `GET /document-assessment`. Порядок — как в `AssessmentSection`.
 */
export function scoreRows(summary: Summary | null, scores: readonly Score[]): ScoreRow[] {
  const byScore = new Map(scores.map((score) => [score.section, score]));
  const sections = (summary?.sections ?? []).filter(
    (info): info is typeof info & { section: AssessmentSection } => !!info.section && (info.maxScore ?? 0) > 0,
  );

  return sections
    .map((info) => {
      const score = byScore.get(info.section);

      return {
        section: info.section,
        maxScore: info.maxScore ?? 0,
        score: score?.score ?? null,
        updatedAt: score?.updatedAt,
      };
    })
    .sort((a, b) => ASSESSMENT_SECTIONS.indexOf(a.section) - ASSESSMENT_SECTIONS.indexOf(b.section));
}

export function totalScore(rows: readonly ScoreRow[]): { score: number; max: number; scored: number } {
  return rows.reduce(
    (sum, row) => ({
      score: sum.score + (row.score ?? 0),
      max: sum.max + row.maxScore,
      scored: sum.scored + (row.score === null ? 0 : 1),
    }),
    { score: 0, max: 0, scored: 0 },
  );
}

/** Балл в допустимом диапазоне `[0; maxScore]` (`DocumentAssessmentService.validate`). */
export function isValidScore(value: number | null, maxScore: number): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= maxScore;
}
