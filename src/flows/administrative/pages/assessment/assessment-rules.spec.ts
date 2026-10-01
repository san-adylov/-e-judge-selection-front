import { isValidScore, scoreRows, totalScore } from './assessment-rules';

describe('assessment rules', () => {
  it('scoreRows: только оцениваемые разделы, в порядке AssessmentSection, с баллами докладчика', () => {
    const rows = scoreRows(
      {
        sections: [
          { section: 'EDUCATION', maxScore: 6, scored: true },
          { section: 'DOCUMENTS', maxScore: 0, scored: false },
          { section: 'IMPECCABILITY', maxScore: 6, scored: false },
          { section: 'ASSETS', maxScore: 1, scored: false },
        ],
      },
      [{ section: 'EDUCATION', score: 4.5, updatedAt: '2026-10-01T10:00:00' }],
    );

    expect(rows.map((row) => row.section)).toEqual(['IMPECCABILITY', 'EDUCATION', 'ASSETS']);
    expect(rows[1]).toEqual({ section: 'EDUCATION', maxScore: 6, score: 4.5, updatedAt: '2026-10-01T10:00:00' });
    expect(rows[0].score).toBeNull();
  });

  it('totalScore суммирует баллы и максимумы, считает оценённые разделы', () => {
    const rows = scoreRows(
      {
        sections: [
          { section: 'EDUCATION', maxScore: 6 },
          { section: 'ASSETS', maxScore: 1 },
        ],
      },
      [{ section: 'EDUCATION', score: 4 }],
    );

    expect(totalScore(rows)).toEqual({ score: 4, max: 7, scored: 1 });
    expect(scoreRows(null, [])).toEqual([]);
  });

  it('isValidScore: от нуля до максимума включительно', () => {
    expect(isValidScore(0, 6)).toBe(true);
    expect(isValidScore(6, 6)).toBe(true);
    expect(isValidScore(6.5, 6)).toBe(false);
    expect(isValidScore(-1, 6)).toBe(false);
    expect(isValidScore(null, 6)).toBe(false);
  });
});
