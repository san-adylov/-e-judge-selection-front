import type { ContestStatus, VisibleStatus } from '@domain/api/api.types';

/** Состояние приёма документов по правилам `SubmissionRules.requireAcceptancePeriod` бэкенда. */
export type AcceptanceState = 'open' | 'not-started' | 'closed';

export interface AcceptanceInput {
  status?: ContestStatus;
  startDate?: string;
  documentAcceptanceEndDate?: string;
}

/**
 * Кнопка конкурса:
 * - `apply` — «Подать заявку»;
 * - `application` — «Моя заявка» (заявка уже есть, `visibleStatus` не `NO_APPLICATION`);
 * - `unavailable` — подача недоступна, причина — для подписи неактивной кнопки.
 */
export type ContestAction =
  { kind: 'apply' } | { kind: 'application' } | { kind: 'unavailable'; reason: 'not-started' | 'closed' | 'banned' };

const BISHKEK_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bishkek',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Сегодняшняя дата сервера (`yyyy-MM-dd`, Asia/Bishkek): бэкенд сравнивает `LocalDate.now(clock)`. */
export function serverToday(now = new Date()): string {
  return BISHKEK_DATE.format(now);
}

/**
 * Приём открыт, если конкурс `PUBLISHED`, дата начала наступила (включительно),
 * а дата окончания ещё не наступила: бэкенд принимает заявки строго до дня окончания.
 * Без `documentAcceptanceEndDate` бэкенд считает срок от даты начала по настройке `durationDays`,
 * фронту она неизвестна — такой конкурс считаем открытым, окончательно решает бэкенд.
 */
export function acceptanceState(contest: AcceptanceInput, today: string): AcceptanceState {
  if (contest.status !== 'PUBLISHED') return 'closed';
  if (contest.startDate && today < contest.startDate) return 'not-started';
  if (contest.documentAcceptanceEndDate && today >= contest.documentAcceptanceEndDate) return 'closed';

  return 'open';
}

/** Кандидат уже участвует: у него есть заявка на конкурс в любом статусе. */
export function isParticipating(visibleStatus: VisibleStatus | null | undefined): boolean {
  return !!visibleStatus && visibleStatus !== 'NO_APPLICATION';
}

export function contestAction(state: {
  participating: boolean;
  acceptance: AcceptanceState;
  banned: boolean;
}): ContestAction {
  if (state.participating) return { kind: 'application' };
  if (state.acceptance !== 'open') return { kind: 'unavailable', reason: state.acceptance };
  if (state.banned) return { kind: 'unavailable', reason: 'banned' };

  return { kind: 'apply' };
}
