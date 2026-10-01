import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LangService } from '@reforgium/presentia';

import { SKIP_ERROR_TOAST } from '@shared/api/http-context';

import {
  AUTO_SUBMIT_SECONDS,
  DRAFT_DEBOUNCE_MS,
  draftKey,
  parseDraft,
  RETRY_DELAY_MS,
  serializeDraft,
  type Submission,
} from './essay.logic';
import { EssayWorkStore } from './essay-work.store';

const MY = '/v1/essay/my';
const REPLY = '/v1/essay/my/reply';
/** 09:40:00 по Бишкеку. */
const NOW = Date.parse('2026-09-29T03:40:00Z');

function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 7,
    applicationId: 15,
    topic: {
      themeRu: 'Независимость судей',
      themeKg: 'Соттордун көз карандысыздыгы',
      timeLimitMinutes: 60,
      subQuestions: [
        { orderNumber: 1, questionRu: 'Первый', questionKg: 'Биринчи' },
        { orderNumber: 2, questionRu: 'Второй', questionKg: 'Экинчи' },
      ],
    },
    startedAt: '2026-09-29T09:00:00',
    deadline: '2026-09-29T10:00:00',
    remainingMinutes: 20,
    submitted: false,
    answers: [],
    ...overrides,
  };
}

describe('EssayWorkStore', () => {
  let store: EssayWorkStore;
  let backend: HttpTestingController;

  const expectMy = (applicationId: string | null = null): TestRequest =>
    backend.expectOne((request) => request.url === MY && request.params.get('applicationId') === applicationId);
  const flushMy = (body: Submission, serverTime = Date.now()) =>
    expectMy().flush(body, { headers: { Date: new Date(serverTime).toUTCString() } });
  const storedDraft = () => parseDraft(sessionStorage.getItem(draftKey(7)));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EssayWorkStore,
        { provide: LangService, useValue: { get: (key: string) => key, currentLang: () => 'ru' } },
      ],
    });

    store = TestBed.inject(EssayWorkStore);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  describe('загрузка', () => {
    it('без черновика — вводная; остаток по часам сервера из заголовка Date', () => {
      store.load();
      // Часы устройства отстают на 30 с: по серверу до срока 19:30 (бэкенд округляет вниз — 19 минут).
      flushMy(submission({ remainingMinutes: 19 }), NOW + 30_000);

      expect(store.phase()).toBe('intro');
      expect(store.remaining()).toBe(19 * 60 + 30);
      expect(store.questions().map((question) => question.text)).toEqual(['Первый', 'Второй']);
      expect(store.answers()).toEqual(['', '']);
    });

    it('с черновиком на устройстве — сразу к тексту с восстановленными ответами', () => {
      sessionStorage.setItem(draftKey(7), serializeDraft(['мой черновик'], NOW - 5000));

      store.load();
      flushMy(submission());

      expect(store.phase()).toBe('writing');
      expect(store.answers()).toEqual(['мой черновик', '']);
      expect(store.savedAt()).toBe(NOW - 5000);
    });

    it('отправленная работа — итог с ответами сервера, черновик удаляется', () => {
      sessionStorage.setItem(draftKey(7), serializeDraft(['старый'], NOW));

      store.load();
      flushMy(submission({ submitted: true, remainingMinutes: 0, answers: ['итог', 'два'] }));

      expect(store.phase()).toBe('done');
      expect(store.answers()).toEqual(['итог', 'два']);
      expect(sessionStorage.getItem(draftKey(7))).toBeNull();
    });

    it('срок вышел без отправки — «время истекло»', () => {
      store.load();
      flushMy(submission({ remainingMinutes: 0, deadline: '2026-09-29T09:39:00' }));

      expect(store.phase()).toBe('expired');
    });

    it('applicationId уходит в запрос только если передан', () => {
      store.load(15);
      expectMy('15').flush(submission());

      expect(store.phase()).toBe('intro');
    });

    it('ошибка загрузки — экран ошибки с сообщением бэкенда', () => {
      store.load();
      expectMy().flush(
        { errorCode: 4318, message: 'Токен этапа не относится к этому упражнению' },
        {
          status: 403,
          statusText: 'Forbidden',
        },
      );

      expect(store.phase()).toBe('error');
      expect(store.loadError()).toBe('Токен этапа не относится к этому упражнению');
    });
  });

  describe('черновик', () => {
    it('«Приступить» сразу отмечает вводную пройденной, ввод сохраняется после паузы', () => {
      store.load();
      flushMy(submission());
      store.start();

      expect(store.phase()).toBe('writing');
      expect(storedDraft()?.answers).toEqual(['', '']);

      store.setAnswer(0, 'Суд');
      store.setAnswer(0, 'Суд независим');

      expect(storedDraft()?.answers).toEqual(['', '']);

      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS);

      expect(storedDraft()?.answers).toEqual(['Суд независим', '']);
      expect(store.savedAt()).toBe(Date.now());
    });

    it('на вводной ввод не принимается', () => {
      store.load();
      flushMy(submission());
      store.setAnswer(0, 'текст');

      expect(store.answers()).toEqual(['', '']);
    });
  });

  describe('отправка', () => {
    beforeEach(() => {
      sessionStorage.setItem(draftKey(7), serializeDraft(['ответ'], NOW));
      store.load();
      flushMy(submission());
    });

    it('PUT со всеми ответами по порядку подвопросов; итог — «отправлено», черновик удалён', () => {
      store.setAnswer(1, 'второй');
      store.submit();

      const request = backend.expectOne(REPLY);

      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ answers: ['ответ', 'второй'] });
      expect(request.request.params.has('applicationId')).toBe(false);
      expect(request.request.context.get(SKIP_ERROR_TOAST)).toBe(false);
      expect(store.phase()).toBe('submitting');
      expect(store.readonly()).toBe(true);

      store.submit();
      backend.expectNone(REPLY);

      request.flush(submission({ submitted: true, finishedAt: '2026-09-29T09:41:00', answers: ['ответ', 'второй'] }));

      expect(store.phase()).toBe('done');
      expect(store.finishedBy()).toBe('manual');
      expect(sessionStorage.getItem(draftKey(7))).toBeNull();
    });

    it('4135 (уже отправлено) — перечитывает работу с сервера', () => {
      store.submit();
      backend.expectOne(REPLY).flush(
        { errorCode: 4135, message: 'Эссе уже было отправлено' },
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
      flushMy(submission({ submitted: true, answers: ['с другой вкладки', ''] }));

      expect(store.phase()).toBe('done');
      expect(store.answers()).toEqual(['с другой вкладки', '']);
    });

    it('4313 (время истекло) — «время истекло»', () => {
      store.submit();
      backend.expectOne(REPLY).flush(
        { errorCode: 4313, message: 'Время истекло' },
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );

      expect(store.phase()).toBe('expired');
    });

    it('сбой ручной отправки до срока — снова можно писать, текст на месте', () => {
      store.submit();
      backend.expectOne(REPLY).error(new ProgressEvent('error'), { status: 0 });

      expect(store.phase()).toBe('writing');
      expect(store.answers()).toEqual(['ответ', '']);
    });
  });

  describe('таймер и автоотправка', () => {
    const deadlineIn = (seconds: number) =>
      submission({
        remainingMinutes: Math.floor(seconds / 60),
        deadline: new Date(NOW + seconds * 1000 + 6 * 3_600_000).toISOString().slice(0, 19),
      });

    beforeEach(() => sessionStorage.setItem(draftKey(7), serializeDraft(['ответ'], NOW)));

    it('уровень таймера меняется на 5 и 1 минуте; сами пороги объявляет компонент таймера', () => {
      store.load();
      flushMy(deadlineIn(5 * 60 + 2));

      expect(store.level()).toBe('normal');

      vi.advanceTimersByTime(2000);

      expect(store.level()).toBe('warning');
      expect(store.announcement()).toBe('');

      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(store.level()).toBe('critical');

      backend.expectNone(REPLY);
    });

    it(`за ${AUTO_SUBMIT_SECONDS} с до срока отправляет сама, без тоста, и повторяет при сбое сети`, () => {
      store.load();
      flushMy(deadlineIn(AUTO_SUBMIT_SECONDS + 5));
      vi.advanceTimersByTime(4000);
      backend.expectNone(REPLY);

      vi.advanceTimersByTime(1000);

      const first = backend.expectOne(REPLY);

      expect(first.request.body).toEqual({ answers: ['ответ', ''] });
      expect(first.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      expect(store.announcement()).toBe('essay.timer.auto-submit');

      first.error(new ProgressEvent('error'), { status: 0 });
      vi.advanceTimersByTime(RETRY_DELAY_MS - 1);
      backend.expectNone(REPLY);
      vi.advanceTimersByTime(1);
      backend.expectOne(REPLY).flush(submission({ submitted: true, answers: ['ответ', ''] }));

      expect(store.phase()).toBe('done');
      expect(store.finishedBy()).toBe('auto');
    });

    it('на вводной до срока не отправляет, по сроку — «время истекло»', () => {
      sessionStorage.clear();
      store.load();
      flushMy(deadlineIn(10));
      vi.advanceTimersByTime(10_000);

      backend.expectNone(REPLY);
      expect(store.phase()).toBe('expired');
    });
  });

  it('перед выходом черновик удаляется с устройства', () => {
    sessionStorage.setItem(draftKey(7), serializeDraft(['ответ'], NOW));
    store.load();
    flushMy(submission());

    store.discardDraft();

    expect(sessionStorage.getItem(draftKey(7))).toBeNull();
    expect(store.savedAt()).toBeNull();
  });
});
