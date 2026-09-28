import type { ApplicationStatus, ContestStatus, ContestType, VisibleStatus } from '@domain/api/api.types';
import { FINAL_APPLICATION_STATUSES } from '@features/application-status/application-actions';

/** Состояние приёма документов по правилам `SubmissionRules.requireAcceptancePeriod` бэкенда. */
export type AcceptanceState = 'open' | 'not-started' | 'closed';

export interface AcceptanceInput {
  status?: ContestStatus;
  startDate?: string;
  documentAcceptanceEndDate?: string;
}

/** Причина, по которой подача недоступна: подпись неактивной кнопки `contests.action.<reason>`. */
export type UnavailableReason = 'not-started' | 'closed' | 'banned' | 'active-same-type';

/**
 * Кнопка конкурса:
 * - `apply` — «Подать заявку»;
 * - `application` — «Моя заявка» (заявка уже есть, `visibleStatus` не `NO_APPLICATION`);
 * - `unavailable` — подача недоступна, причина — для подписи неактивной кнопки.
 */
export type ContestAction =
  { kind: 'apply' } | { kind: 'application' } | { kind: 'unavailable'; reason: UnavailableReason };

/** Заявка кандидата в объёме, нужном для правил подачи. */
export interface OwnApplication {
  id?: number;
  contestId?: number;
  status?: ApplicationStatus;
}

/**
 * Заявки кандидата, сопоставленные с конкурсами:
 * `applicationIds` — id конкурса → id заявки (в карточке конкурса его нет);
 * `activeTypes` — конкурсы с активной (не финальной) заявкой и их тип (`null` — конкурс без типа).
 */
export interface Participation {
  readonly applicationIds: ReadonlyMap<number, number>;
  readonly activeTypes: ReadonlyMap<number, ContestType | null>;
}

export const NO_PARTICIPATION: Participation = { applicationIds: new Map(), activeTypes: new Map() };

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

/** Кандидат уже участвует: у него есть заявка на конкурс в любом статусе (повторная подача — 4091). */
export function isParticipating(visibleStatus: VisibleStatus | null | undefined): boolean {
  return !!visibleStatus && visibleStatus !== 'NO_APPLICATION';
}

/**
 * Сопоставляет заявки кандидата (`GET /contest-application/my`) с конкурсами.
 * `contestTypes` — тип каждого известного конкурса; заявки на неизвестные конкурсы в `activeTypes` не попадают.
 */
export function participationOf(
  applications: readonly OwnApplication[],
  contestTypes: ReadonlyMap<number, ContestType | null>,
): Participation {
  const applicationIds = new Map<number, number>();
  const activeTypes = new Map<number, ContestType | null>();

  for (const { id, contestId, status } of applications) {
    if (contestId === undefined) continue;
    if (id !== undefined) applicationIds.set(contestId, id);

    const active = !!status && !FINAL_APPLICATION_STATUSES.has(status);

    if (active && contestTypes.has(contestId)) activeTypes.set(contestId, contestTypes.get(contestId) ?? null);
  }

  return { applicationIds, activeTypes };
}

/**
 * `SubmissionRules.requireNoActiveInSameType` (4102): параллельно можно участвовать только в конкурсах разных типов.
 * Конкурсы без типа считаются одним типом.
 */
export function hasActiveInSameType(
  contest: { id?: number; type?: ContestType | null },
  participation: Participation,
): boolean {
  const type = contest.type ?? null;

  for (const [contestId, activeType] of participation.activeTypes) {
    if (contestId !== contest.id && activeType === type) return true;
  }

  return false;
}

/**
 * Порядок проверок как у `ApplicationSubmissionService.createDraft`, кроме «уже участвует»:
 * своя заявка показывается ссылкой «Моя заявка» при любых сроках и ограничениях.
 * Возраст (4305) и заполненность личных данных (4137) проверяет только бэкенд.
 */
export function contestAction(state: {
  participating: boolean;
  acceptance: AcceptanceState;
  banned: boolean;
  activeSameType?: boolean;
}): ContestAction {
  if (state.participating) return { kind: 'application' };
  if (state.banned) return { kind: 'unavailable', reason: 'banned' };
  if (state.acceptance !== 'open') return { kind: 'unavailable', reason: state.acceptance };
  if (state.activeSameType) return { kind: 'unavailable', reason: 'active-same-type' };

  return { kind: 'apply' };
}

/**
 * Действие по карточке конкурса из `GET /contest/available` с учётом заявок кандидата и отстранения.
 * Заявка из `/my` тоже считается участием: карточка могла устареть.
 */
export function actionFor(
  contest: AcceptanceInput & { id?: number; type?: ContestType | null; visibleStatus?: VisibleStatus },
  context: { today: string; banned: boolean; participation: Participation },
): ContestAction {
  const hasOwn = contest.id !== undefined && context.participation.applicationIds.has(contest.id);

  return contestAction({
    participating: isParticipating(contest.visibleStatus) || hasOwn,
    acceptance: acceptanceState(contest, context.today),
    banned: context.banned,
    activeSameType: hasActiveInSameType(contest, context.participation),
  });
}
