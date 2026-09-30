import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { QuizQuestion, TestResult, TestView } from './quiz.logic';
import { QuizStore } from './quiz.store';

const BASE = '/v1/tests/15';

function question(
  number: number,
  selected: number[] = [],
  choiceType: QuizQuestion['choiceType'] = 'SINGLE',
): QuizQuestion {
  return {
    number,
    choiceType,
    textRu: `Вопрос ${number}`,
    options: [{ id: number * 10 + 1 }, { id: number * 10 + 2 }, { id: number * 10 + 3 }],
    selectedOptionIds: selected,
    answered: selected.length > 0,
  };
}

function view(questions: QuizQuestion[], overrides: Partial<TestView> = {}): TestView {
  return {
    testId: 15,
    remainingSeconds: 600,
    finished: false,
    questionCount: questions.length,
    answeredCount: questions.filter((item) => item.answered).length,
    questions,
    ...overrides,
  };
}

const RESULT: TestResult = { testId: 15, questionCount: 3, correctAnswers: 3, passingCorrectAnswers: 3, passed: true };

function apiError(errorCode: number, status = 400) {
  return [
    { errorCode, message: `error ${errorCode}` },
    { status, statusText: 'Error' },
  ] as const;
}

describe('QuizStore', () => {
  let store: QuizStore;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), QuizStore],
    });
    store = TestBed.inject(QuizStore);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  function start(questions = [question(1), question(2), question(3)], overrides: Partial<TestView> = {}): void {
    store.load(15);
    backend.expectOne(`${BASE}`).flush(view(questions, overrides));
    TestBed.tick();
  }

  function expectAnswer(number: number): TestRequest {
    const request = backend.expectOne(`${BASE}/questions/${number}/answer`);

    expect(request.request.method).toBe('POST');

    return request;
  }

  it('resumes on the first unanswered question with the server time', () => {
    start([question(1, [11]), question(2), question(3)], { remainingSeconds: 125 });

    expect(store.phase()).toBe('running');
    expect(store.current()).toBe(2);
    expect(store.answeredCount()).toBe(1);
    expect(store.secondsLeft()).toBe(125);

    vi.advanceTimersByTime(5_000);
    expect(store.secondsLeft()).toBe(120);
  });

  it('treats an already finished test as finished', () => {
    start([question(1, [11])], { finished: true, remainingSeconds: 0 });

    expect(store.phase()).toBe('finished');
    expect(store.result()).toBeNull();
  });

  it('keeps the choice as a draft and ignores changes to saved answers', () => {
    start([question(1, [11]), question(2, [], 'MULTIPLE')]);

    store.go(1);
    store.select(12);
    expect(store.selection()).toEqual([11]);

    store.go(2);
    store.select(21);
    store.select(22);
    store.select(21);
    expect(store.selection()).toEqual([22]);
    expect(store.draftCount()).toBe(1);
  });

  it('sends answers one at a time and applies each returned view', () => {
    start();

    store.select(11);
    store.save();
    store.go(2);
    store.select(22);
    store.save();

    expect(store.saving()).toEqual(new Set([1, 2]));

    const first = expectAnswer(1);

    expect(first.request.body).toEqual({ optionIds: [11] });
    backend.expectNone(`${BASE}/questions/2/answer`);

    first.flush(view([question(1, [11]), question(2), question(3)]));

    const second = expectAnswer(2);

    expect(second.request.body).toEqual({ optionIds: [22] });
    second.flush(view([question(1, [11]), question(2, [22]), question(3)]));

    expect(store.saving().size).toBe(0);
    expect(store.answeredCount()).toBe(2);
    expect(store.drafts().size).toBe(0);
    // После сохранения — к следующему вопросу без ответа.
    expect(store.current()).toBe(3);
  });

  it('does not save twice while the answer is in flight', () => {
    start();

    store.select(11);
    store.save();
    store.save();
    store.select(12);
    expect(store.selection()).toEqual([11]);

    expectAnswer(1).flush(view([question(1, [11]), question(2), question(3)]));
    expect(store.questions()[0]?.selectedOptionIds).toEqual([11]);
  });

  it('retries transient failures and keeps the draft after a final failure', () => {
    start();

    store.select(11);
    store.save();

    expectAnswer(1).flush(null, { status: 503, statusText: 'Unavailable' });
    vi.advanceTimersByTime(1_000);
    // Обрыв связи: HttpErrorResponse со статусом 0.
    expectAnswer(1).error(new ProgressEvent('error'));
    vi.advanceTimersByTime(2_000);
    expectAnswer(1).flush(null, { status: 503, statusText: 'Unavailable' });

    expect(store.currentError()).toBe('');
    expect(store.selection()).toEqual([11]);
    expect(store.currentSaving()).toBe(false);

    store.save();
    expectAnswer(1).flush(view([question(1, [11]), question(2), question(3)]));
    expect(store.currentError()).toBeNull();
  });

  it('reloads the view when the answer is already on the server (4116)', () => {
    start();

    store.select(12);
    store.save();
    expectAnswer(1).flush(...apiError(4116, 409));
    backend.expectOne(BASE).flush(view([question(1, [11]), question(2), question(3)]));

    expect(store.question()?.selectedOptionIds).toEqual([11]);
    expect(store.currentError()).toBeNull();
  });

  it('shows the result when time ran out on the server (4133)', () => {
    start();

    store.select(11);
    store.save();
    expectAnswer(1).flush(...apiError(4133));
    backend.expectOne(`${BASE}/result`).flush(RESULT);

    expect(store.timeUp()).toBe(true);
    expect(store.phase()).toBe('finished');
    expect(store.result()).toEqual(RESULT);
  });

  it('finishes only after pending answers are saved', () => {
    start();

    store.select(11);
    store.save();
    store.finish();

    expect(store.phase()).toBe('finishing');
    backend.expectNone(`${BASE}/finish`);

    expectAnswer(1).flush(view([question(1, [11]), question(2), question(3)]));

    const finish = backend.expectOne(`${BASE}/finish`);

    expect(finish.request.method).toBe('POST');
    finish.flush(RESULT);

    expect(store.phase()).toBe('finished');
    expect(store.result()).toEqual(RESULT);
    expect(store.timeUp()).toBe(false);
  });

  it('skips the queued finish when an answer already finished the test', () => {
    start();

    store.select(11);
    store.save();
    store.finish();
    expectAnswer(1).flush(...apiError(4118));
    backend.expectOne(`${BASE}/result`).flush(RESULT);

    backend.expectNone(`${BASE}/finish`);
    expect(store.phase()).toBe('finished');
  });

  it('loads the result when the test was finished elsewhere (4118)', () => {
    start();

    store.finish();
    backend.expectOne(`${BASE}/finish`).flush(...apiError(4118));
    backend.expectOne(`${BASE}/result`).flush(RESULT);

    expect(store.result()).toEqual(RESULT);
  });

  it('returns to the questions when finishing fails', () => {
    start();

    store.finish();
    backend.expectOne(`${BASE}/finish`).flush(...apiError(4031, 403));

    expect(store.phase()).toBe('running');
    expect(store.finishError()).toBe('error 4031');
  });

  it('finishes automatically when the countdown reaches zero', () => {
    start(undefined, { remainingSeconds: 2 });

    vi.advanceTimersByTime(2_500);
    TestBed.tick();

    expect(store.timeUp()).toBe(true);
    backend.expectOne(`${BASE}/finish`).flush(RESULT);
    expect(store.phase()).toBe('finished');
  });

  it('reports a load error with the backend message', () => {
    store.load(15);
    backend.expectOne(BASE).flush(...apiError(4318, 403));

    expect(store.phase()).toBe('error');
    expect(store.loadError()).toBe('error 4318');
  });
});
