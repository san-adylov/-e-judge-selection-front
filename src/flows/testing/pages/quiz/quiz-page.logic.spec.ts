import { finishConfirmMessage, resultStateFor } from './quiz-page.logic';

const t = (key: string, params?: Record<string, number>) => (params ? `${key}:${JSON.stringify(params)}` : key);

describe('finishConfirmMessage', () => {
  it('asks plainly when everything is answered', () => {
    expect(finishConfirmMessage({ unanswered: 0, total: 5, drafts: 0 }, t)).toBe('quiz.finish.confirm-all');
  });

  it('lists the unanswered count', () => {
    expect(finishConfirmMessage({ unanswered: 2, total: 5, drafts: 0 }, t)).toBe(
      'quiz.finish.confirm-unanswered:{"count":2,"total":5}',
    );
  });

  it('warns that unsaved choices are not counted', () => {
    expect(finishConfirmMessage({ unanswered: 1, total: 5, drafts: 1 }, t)).toBe(
      'quiz.finish.confirm-unanswered:{"count":1,"total":5} quiz.finish.confirm-drafts:{"count":1}',
    );
  });
});

describe('resultStateFor', () => {
  const result = { testId: 15, questionCount: 10, correctAnswers: 9 };

  it('takes the result passed by the quiz page for the same test', () => {
    expect(resultStateFor({ navigationId: 3, testId: 15, quizResult: result, timeUp: true }, 15)).toEqual({
      testId: 15,
      quizResult: result,
      timeUp: true,
    });
    expect(resultStateFor({ testId: 15, quizResult: null, timeUp: false }, 15)).toEqual({
      testId: 15,
      quizResult: null,
      timeUp: false,
    });
  });

  it('ignores foreign or missing state', () => {
    expect(resultStateFor({ testId: 16, quizResult: result, timeUp: false }, 15)).toBeNull();
    expect(resultStateFor({ navigationId: 1 }, 15)).toBeNull();
    expect(resultStateFor(null, 15)).toBeNull();
    expect(resultStateFor('x', 15)).toBeNull();
  });
});
