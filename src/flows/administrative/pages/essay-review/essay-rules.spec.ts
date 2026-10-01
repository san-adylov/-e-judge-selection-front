import { essayAnswers, isValidEssayScore, myEssayScore } from './essay-rules';

describe('essay review rules', () => {
  it('essayAnswers сопоставляет ответы подвопросам по порядку', () => {
    const answers = essayAnswers({
      topic: {
        subQuestions: [
          { orderNumber: 2, questionRu: 'Второй' },
          { orderNumber: 1, questionRu: 'Первый' },
        ],
      },
      answers: ['ответ 1', 'ответ 2'],
    });

    expect(answers).toEqual([
      { number: 1, questionRu: 'Первый', questionKg: undefined, answer: 'ответ 1' },
      { number: 2, questionRu: 'Второй', questionKg: undefined, answer: 'ответ 2' },
    ]);
    expect(essayAnswers({ answers: ['текст'] })).toEqual([{ number: 1, answer: 'текст' }]);
    expect(essayAnswers({})).toEqual([{ number: 1, answer: '' }]);
  });

  it('myEssayScore находит оценку текущего проверяющего', () => {
    const submission = { scores: [{ boardMemberId: 3, score: 7 }] };

    expect(myEssayScore(submission, 3)).toBe(7);
    expect(myEssayScore(submission, 4)).toBeNull();
    expect(myEssayScore({}, 3)).toBeNull();
  });

  it('isValidEssayScore: от 0 до 10', () => {
    expect(isValidEssayScore(0)).toBe(true);
    expect(isValidEssayScore(10)).toBe(true);
    expect(isValidEssayScore(10.5)).toBe(false);
    expect(isValidEssayScore(null)).toBe(false);
  });
});
