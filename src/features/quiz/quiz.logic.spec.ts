import {
  adjacentNumber,
  deadlineAt,
  formatCountdown,
  nextUnanswered,
  paletteItems,
  quizAccess,
  type QuizQuestion,
  resultSummary,
  secondsLeft,
  sortQuestions,
  timerLevel,
  toggleOption,
  unansweredNumbers,
  warningToAnnounce,
} from './quiz.logic';

const q = (number: number, answered = false): QuizQuestion => ({ number, answered, choiceType: 'SINGLE' });

describe('quiz timer math', () => {
  it('counts down from remainingSeconds received from the server', () => {
    const deadline = deadlineAt(90, 1_000);

    expect(deadline).toBe(91_000);
    expect(secondsLeft(deadline, 1_000)).toBe(90);
    expect(secondsLeft(deadline, 1_400)).toBe(90);
    expect(secondsLeft(deadline, 2_000)).toBe(89);
    expect(secondsLeft(deadline, 90_999)).toBe(1);
    expect(secondsLeft(deadline, 91_000)).toBe(0);
    expect(secondsLeft(deadline, 200_000)).toBe(0);
  });

  it('treats missing or negative remainingSeconds as expired', () => {
    expect(deadlineAt(undefined, 5_000)).toBe(5_000);
    expect(deadlineAt(-10, 5_000)).toBe(5_000);
  });

  it('formats hours, minutes and seconds', () => {
    expect(formatCountdown(7200)).toBe('2:00:00');
    expect(formatCountdown(3661)).toBe('1:01:01');
    expect(formatCountdown(3599)).toBe('59:59');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-3)).toBe('00:00');
  });

  it('switches level at 5 minutes and 1 minute', () => {
    expect(timerLevel(301)).toBe('normal');
    expect(timerLevel(300)).toBe('warning');
    expect(timerLevel(61)).toBe('warning');
    expect(timerLevel(60)).toBe('critical');
  });

  it('announces each warning once and only the most urgent one after a resume', () => {
    expect(warningToAnnounce(400, new Set())).toBeNull();
    expect(warningToAnnounce(300, new Set())).toBe(300);
    expect(warningToAnnounce(200, new Set([300]))).toBeNull();
    expect(warningToAnnounce(60, new Set([300]))).toBe(60);
    expect(warningToAnnounce(30, new Set())).toBe(60);
    expect(warningToAnnounce(0, new Set())).toBeNull();
  });
});

describe('quiz navigation', () => {
  const questions = sortQuestions([q(3), q(1, true), q(2), q(4, true)]);

  it('sorts by order number', () => {
    expect(questions.map((item) => item.number)).toEqual([1, 2, 3, 4]);
  });

  it('moves to adjacent questions and stops at the edges', () => {
    expect(adjacentNumber(questions, 2, 1)).toBe(3);
    expect(adjacentNumber(questions, 2, -1)).toBe(1);
    expect(adjacentNumber(questions, 1, -1)).toBeNull();
    expect(adjacentNumber(questions, 4, 1)).toBeNull();
    expect(adjacentNumber(questions, 99, 1)).toBeNull();
  });

  it('finds the next unanswered question, wrapping around and skipping excluded', () => {
    expect(unansweredNumbers(questions)).toEqual([2, 3]);
    expect(nextUnanswered(questions, 0)).toBe(2);
    expect(nextUnanswered(questions, 2)).toBe(3);
    expect(nextUnanswered(questions, 3)).toBe(2);
    expect(nextUnanswered(questions, 3, new Set([2]))).toBeNull();
    expect(nextUnanswered([q(1, true)], 1)).toBeNull();
  });

  it('marks answered, current, draft, saving and failed items in the palette', () => {
    const items = paletteItems(
      questions,
      2,
      new Map([
        [3, [7]],
        [1, [5]],
      ]),
      new Set([3]),
      new Set([2]),
    );

    expect(items).toEqual([
      { number: 1, answered: true, current: false, draft: false, saving: false, failed: false },
      { number: 2, answered: false, current: true, draft: false, saving: false, failed: true },
      { number: 3, answered: false, current: false, draft: true, saving: true, failed: false },
      { number: 4, answered: true, current: false, draft: false, saving: false, failed: false },
    ]);
  });
});

describe('quiz selection', () => {
  it('replaces the choice for SINGLE', () => {
    expect(toggleOption('SINGLE', [1], 2)).toEqual([2]);
    expect(toggleOption(undefined, [], 3)).toEqual([3]);
  });

  it('toggles options for MULTIPLE', () => {
    expect(toggleOption('MULTIPLE', [1], 2)).toEqual([1, 2]);
    expect(toggleOption('MULTIPLE', [1, 2], 1)).toEqual([2]);
  });
});

describe('quiz access', () => {
  it('accepts the stage exercise and ordinary candidate tokens', () => {
    expect(quizAccess('15', { exerciseId: 15, exerciseType: 'TEST' })).toEqual({ kind: 'ok', testId: 15 });
    expect(quizAccess('15', null)).toEqual({ kind: 'ok', testId: 15 });
  });

  it('redirects on a foreign exercise, essay token or malformed id', () => {
    expect(quizAccess('16', { exerciseId: 15, exerciseType: 'TEST' })).toEqual({ kind: 'redirect' });
    expect(quizAccess('15', { exerciseId: 15, exerciseType: 'ESSAY' })).toEqual({ kind: 'redirect' });
    expect(quizAccess('abc', null)).toEqual({ kind: 'redirect' });
    expect(quizAccess('1.5', null)).toEqual({ kind: 'redirect' });
    expect(quizAccess('0', null)).toEqual({ kind: 'redirect' });
    expect(quizAccess('', null)).toEqual({ kind: 'redirect' });
  });
});

describe('quiz result', () => {
  it('computes a floored percentage', () => {
    expect(
      resultSummary({ questionCount: 150, correctAnswers: 119, passingCorrectAnswers: 120, passed: false }),
    ).toEqual({ questionCount: 150, correct: 119, passing: 120, percent: 79, passed: false });
  });

  it('keeps unknown values empty', () => {
    expect(resultSummary({ questionCount: 0 })).toEqual({
      questionCount: 0,
      correct: null,
      passing: 0,
      percent: null,
      passed: null,
    });
  });
});
