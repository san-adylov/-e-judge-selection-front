import { answerRows, answerValue, toAnswerRequest, unansweredCount } from './answers';

describe('additional info answers', () => {
  const questions = [
    { id: 3, textRu: 'Третий', sortOrder: 2 },
    { id: 1, textRu: 'Первый', sortOrder: 1 },
    { id: 2, textRu: 'Неактивный', sortOrder: 0, active: false },
    { id: 4, textRu: 'Без порядка' },
  ];
  const answers = [
    { id: 10, questionId: 1, applicationId: 7, answer: 'старый' },
    { id: 11, questionId: 1, applicationId: 7, answer: 'новый' },
    { id: 12, questionId: 3, applicationId: 8, answer: 'другая заявка' },
    { id: 13, questionId: 3, judgeApplicationId: 7, answer: 'заявка судьи' },
  ];

  it('orders active questions by sortOrder and binds answers of this application only', () => {
    const rows = answerRows(questions, answers, { applicationId: 7 });

    expect(rows.map((row) => [row.questionId, row.answer?.id ?? null])).toEqual([
      [4, null],
      [1, 11],
      [3, null],
    ]);
    expect(unansweredCount(rows)).toBe(2);
  });

  it('binds answers of a judge application separately', () => {
    const rows = answerRows(questions, answers, { judgeApplicationId: 7 });

    expect(rows.find((row) => row.questionId === 3)?.answer?.id).toBe(13);
    expect(rows.find((row) => row.questionId === 1)?.answer).toBeNull();
  });

  it('builds a request with exactly one application id and a trimmed answer', () => {
    expect(toAnswerRequest({ applicationId: 7 }, 1, { answer: '  да ', fileId: null })).toEqual({
      questionId: 1,
      applicationId: 7,
      answer: 'да',
    });
    expect(toAnswerRequest({ judgeApplicationId: 5 }, 2, { answer: 'нет', fileId: 42 })).toEqual({
      questionId: 2,
      judgeApplicationId: 5,
      answer: 'нет',
      fileId: 42,
    });
  });

  it('maps a saved answer to form values', () => {
    expect(answerValue(null)).toEqual({ answer: '', fileId: null });
    expect(answerValue({ answer: 'текст', fileId: 9 })).toEqual({ answer: 'текст', fileId: 9 });
  });
});
