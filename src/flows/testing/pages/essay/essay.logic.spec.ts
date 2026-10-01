import {
  draftKey,
  initialPhase,
  normalizeAnswers,
  parseDraft,
  questionsOf,
  remainingAtResponse,
  serializeDraft,
  type Submission,
  textStats,
  toReplyRequest,
  unansweredNumbers,
} from './essay.logic';

/** 2026-09-29T10:00:00 по Бишкеку (UTC+6). */
const DEADLINE = '2026-09-29T10:00:00';
const DEADLINE_MS = Date.parse('2026-09-29T04:00:00Z');

describe('essay.logic', () => {
  describe('remainingAtResponse', () => {
    it('считает секунды по времени сервера из заголовка Date', () => {
      const serverTime = DEADLINE_MS - (12 * 60 + 34) * 1000;

      expect(remainingAtResponse({ deadline: DEADLINE, remainingMinutes: 12 }, serverTime, 0)).toBe(12 * 60 + 34);
    });

    it('без заголовка Date берёт часы устройства', () => {
      const clientTime = DEADLINE_MS - 90_500;

      expect(remainingAtResponse({ deadline: DEADLINE, remainingMinutes: 1 }, null, clientTime)).toBe(90);
    });

    it('зажимает оценку в окно remainingMinutes, если часы устройства ушли больше чем на минуту', () => {
      // Часы устройства отстают на 10 минут: «по ним» осталось 22 минуты, сервер говорит 12.
      const behind = DEADLINE_MS - 22 * 60_000;
      // Часы спешат на 10 минут: «по ним» осталось 2 минуты.
      const ahead = DEADLINE_MS - 2 * 60_000;

      expect(remainingAtResponse({ deadline: DEADLINE, remainingMinutes: 12 }, null, behind)).toBe(12 * 60 + 59);
      expect(remainingAtResponse({ deadline: DEADLINE, remainingMinutes: 12 }, null, ahead)).toBe(12 * 60);
    });

    it('при remainingMinutes = 0 разрешает 0…59 секунд и не уходит в минус', () => {
      expect(remainingAtResponse({ deadline: DEADLINE, remainingMinutes: 0 }, DEADLINE_MS - 20_000, 0)).toBe(20);
      expect(remainingAtResponse({ deadline: DEADLINE, remainingMinutes: 0 }, DEADLINE_MS + 5_000, 0)).toBe(0);
    });

    it('без deadline — нижняя граница минут; отправленная работа — 0', () => {
      expect(remainingAtResponse({ remainingMinutes: 3 }, null, 0)).toBe(180);
      expect(remainingAtResponse({ deadline: DEADLINE, remainingMinutes: 0, submitted: true }, null, 0)).toBe(0);
    });
  });

  describe('вопросы и ответы', () => {
    const submission: Submission = {
      id: 5,
      topic: {
        themeRu: 'Тема',
        themeKg: 'Тема кг',
        subQuestions: [
          { orderNumber: 2, questionRu: 'Второй', questionKg: 'Экинчи' },
          { orderNumber: 1, questionRu: 'Первый', questionKg: 'Биринчи' },
        ],
      },
    };

    it('questionsOf сортирует по orderNumber и берёт язык интерфейса', () => {
      expect(questionsOf(submission, 'kg')).toEqual([
        { number: 1, text: 'Биринчи' },
        { number: 2, text: 'Экинчи' },
      ]);
    });

    it('без подвопросов — один ответ на тему', () => {
      expect(questionsOf({ topic: { themeRu: 'Тема' } }, 'ru')).toEqual([{ number: 1, text: '' }]);
    });

    it('toReplyRequest: ровно по ответу на каждый подвопрос, по порядку', () => {
      expect(toReplyRequest(['a'], 3)).toEqual({ answers: ['a', '', ''] });
      expect(toReplyRequest(['a', 'b', 'c'], 2)).toEqual({ answers: ['a', 'b'] });
      expect(normalizeAnswers([1, null, 'x'], 3)).toEqual(['', '', 'x']);
    });

    it('unansweredNumbers не считает пробелы ответом', () => {
      expect(unansweredNumbers(['текст', '  \n', ''])).toEqual([2, 3]);
    });
  });

  it('textStats считает слова (с дефисом — одно) и знаки без краевых пробелов', () => {
    expect(textStats('')).toEqual({ words: 0, chars: 0 });
    expect(textStats('  Суд — это кое-что важное.  ')).toEqual({ words: 4, chars: 25 });
    expect(textStats('Сот 2026-жылы')).toEqual({ words: 2, chars: 13 });
  });

  describe('черновик', () => {
    it('ключ по id работы', () => {
      expect(draftKey(42)).toBe('ejs2.essay-draft.42');
    });

    it('serializeDraft ↔ parseDraft', () => {
      expect(parseDraft(serializeDraft(['a', 'b'], 1000))).toEqual({ v: 1, answers: ['a', 'b'], savedAt: 1000 });
    });

    it('битый или чужой JSON — как отсутствие черновика', () => {
      expect(parseDraft(null)).toBeNull();
      expect(parseDraft('{')).toBeNull();
      expect(parseDraft('{"answers":["a"],"savedAt":1}')).toBeNull();
      expect(parseDraft('{"v":1,"answers":"a","savedAt":1}')).toBeNull();
      expect(parseDraft('{"v":1,"answers":["a",5],"savedAt":1}')).toEqual({ v: 1, answers: ['a', ''], savedAt: 1 });
    });
  });

  it('initialPhase', () => {
    expect(initialPhase({ submitted: true }, 0, true)).toBe('done');
    expect(initialPhase({ submitted: false }, 0, true)).toBe('expired');
    expect(initialPhase({ submitted: false }, 100, true)).toBe('writing');
    expect(initialPhase({ submitted: false }, 100, false)).toBe('intro');
  });
});
