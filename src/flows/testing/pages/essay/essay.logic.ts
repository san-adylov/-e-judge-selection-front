import type { Schemas } from '@domain/api/api.types';
import { parseServerDateTime } from '@shared/lib/dates';
import { localized } from '@shared/lib/language';

export type Submission = Schemas['EssaySubmissionResponse'];
export type ReplyRequest = Schemas['EssayReplyRequest'];

/**
 * За сколько секунд до срока работа уходит автоматически. Черновиков на сервере нет, а после срока
 * бэкенд отвечает 4313 — текст нужно успеть отправить с запасом на сеть.
 */
export const AUTO_SUBMIT_SECONDS = 15;
/** Пауза записи черновика после ввода, мс. */
export const DRAFT_DEBOUNCE_MS = 500;
/** Пауза между повторами автоотправки при сбое сети, мс. */
export const RETRY_DELAY_MS = 3000;

export const ESSAY_ERRORS = { ALREADY_SUBMITTED: 4135, TIME_LIMIT: 4313, STAGE_TOKEN_MISMATCH: 4318 } as const;

// ---------- Таймер ----------

/**
 * Сколько секунд оставалось в момент ответа сервера. Сервер отдаёт `deadline` (LocalDateTime Бишкека)
 * и `remainingMinutes` — целые минуты вниз, значит истинный остаток лежит в [M·60; M·60 + 59].
 * Секунды берутся из `deadline` минус время сервера (заголовок `Date`) или, если его нет, часы устройства;
 * результат зажимается в окно `remainingMinutes`, поэтому расхождение часов больше минуты не влияет.
 */
export function remainingAtResponse(
  submission: Pick<Submission, 'deadline' | 'remainingMinutes' | 'submitted'>,
  serverTime: number | null,
  clientTime: number,
): number {
  if (submission.submitted) return 0;

  const deadline = parseServerDateTime(submission.deadline)?.getTime() ?? null;
  const now = serverTime ?? clientTime;
  const estimate = deadline === null ? null : Math.floor((deadline - now) / 1000);
  const minutes = submission.remainingMinutes;

  if (minutes === undefined || minutes === null) return Math.max(0, estimate ?? 0);

  const low = minutes * 60;
  const high = low + 59;

  if (estimate === null) return low;

  // M = 0 бывает и после срока (бэкенд делает max(0, …)), поэтому нижняя граница — 0, а не 0·60.
  return Math.max(0, Math.min(high, minutes === 0 ? estimate : Math.max(low, estimate)));
}

// ---------- Тема и ответы ----------

export interface EssayQuestion {
  /** Номер по порядку, с 1. */
  number: number;
  text: string;
}

/** Подвопросы в порядке `orderNumber`; без подвопросов — один ответ на саму тему. */
export function questionsOf(submission: Submission | null, lang: string): EssayQuestion[] {
  const items = [...(submission?.topic?.subQuestions ?? [])].sort(
    (a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0),
  );

  if (!items.length) return [{ number: 1, text: '' }];

  return items.map((item, index) => ({ number: index + 1, text: localized(item.questionRu, item.questionKg, lang) }));
}

/** Ровно `count` строк: лишнее отбрасывается, недостающее — пустые. */
export function normalizeAnswers(answers: readonly unknown[] | null | undefined, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const value = answers?.[index];

    return typeof value === 'string' ? value : '';
  });
}

/** Тело `PUT /essay/my/reply`: ответы по порядку подвопросов, по одному на каждый. */
export function toReplyRequest(answers: readonly string[], count: number): ReplyRequest {
  return { answers: normalizeAnswers(answers, count) };
}

/** Номера подвопросов без ответа (пусто или одни пробелы). */
export function unansweredNumbers(answers: readonly string[]): number[] {
  return answers.flatMap((answer, index) => (answer.trim() ? [] : [index + 1]));
}

// ---------- Счётчик ----------

export interface TextStats {
  words: number;
  chars: number;
}

/** Слова — последовательности букв и цифр (через дефис и апостроф — одно слово); знаки — без пробелов по краям. */
export function textStats(text: string): TextStats {
  const trimmed = text.trim();

  return {
    words: trimmed ? (trimmed.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)?.length ?? 0) : 0,
    chars: trimmed.length,
  };
}

// ---------- Черновик на устройстве ----------

/** Локальная копия ответов: сервер хранит только итоговую отправку. */
export interface EssayDraft {
  v: 1;
  answers: string[];
  /** Время последней записи, мс с эпохи. */
  savedAt: number;
}

export function draftKey(submissionId: number): string {
  return `ejs2.essay-draft.${submissionId}`;
}

export function serializeDraft(answers: readonly string[], savedAt: number): string {
  return JSON.stringify({ v: 1, answers: [...answers], savedAt } satisfies EssayDraft);
}

/** Разбор с проверкой формы: чужой или битый JSON — как отсутствие черновика. */
export function parseDraft(raw: string | null | undefined): EssayDraft | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<EssayDraft> | null;

    if (value?.v !== 1 || !Array.isArray(value.answers) || typeof value.savedAt !== 'number') return null;

    return {
      v: 1,
      answers: value.answers.map((item) => (typeof item === 'string' ? item : '')),
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}

// ---------- Состояние экрана ----------

export type EssayPhase = 'loading' | 'error' | 'intro' | 'writing' | 'submitting' | 'done' | 'expired';

/** Экран по ответу сервера: отправлено → итог; срок вышел → «время истекло»; есть черновик → сразу к тексту. */
export function initialPhase(submission: Submission, remaining: number, hasDraft: boolean): EssayPhase {
  if (submission.submitted) return 'done';
  if (remaining <= 0) return 'expired';

  return hasDraft ? 'writing' : 'intro';
}
