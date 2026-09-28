import type { Schemas } from '@domain/api/api.types';
import { parseServerDateTime } from '@shared/lib/dates';

export type Vacancy = Schemas['VacancyResponse'];
export type VacancyApplication = Schemas['VacancyApplicationResponse'];
export type VacancyApplicationStatus = NonNullable<VacancyApplication['status']>;
export type Reserve = Schemas['ReserveResponse'];

/** Заявки, которые занимают место в вакансии (spec 16/4): повторно откликнуться нельзя. */
const OCCUPYING: ReadonlySet<VacancyApplicationStatus> = new Set(['DRAFT', 'SUBMITTED', 'APPROVED']);

/** Типы уведомлений, после которых меняются предложения и отклики (`ReserveVacancyNotificationListener`). */
export const VACANCY_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  'RESERVE_EXPIRY',
  'SUPREME_COURT',
  'CONSTITUTIONAL_COURT',
]);

/** Что кандидат может сделать с откликом (`VacancyApplicationStateMachine` + `VacancyApplication.confirmOffer`). */
export interface ApplicationActions {
  /** DRAFT → SUBMITTED: согласие на предложение до крайнего срока. */
  confirm: boolean;
  /** DRAFT/SUBMITTED → WITHDRAWN: отказ от предложения или отзыв заявки; позиция в резерве снова активна. */
  withdraw: boolean;
}

/** Предложение (DRAFT) с истёкшим сроком отклика: подтвердить уже нельзя, фоновая задача переведёт в RESERVE_EXPIRED. */
export function isOfferExpired(application: VacancyApplication, now: Date = new Date()): boolean {
  if (application.status !== 'DRAFT') return false;

  const deadline = parseServerDateTime(application.responseDeadline);

  return deadline !== null && now.getTime() > deadline.getTime();
}

export function applicationActions(application: VacancyApplication, now: Date = new Date()): ApplicationActions {
  switch (application.status) {
    case 'DRAFT':
      return { confirm: !isOfferExpired(application, now), withdraw: true };
    case 'SUBMITTED':
      return { confirm: false, withdraw: true };
    default:
      return { confirm: false, withdraw: false };
  }
}

/** Отказ от предложения (DRAFT) или отзыв поданной заявки (SUBMITTED) — разные подписи и тексты подтверждения. */
export function withdrawKind(application: VacancyApplication): 'decline' | 'withdraw' {
  return application.status === 'DRAFT' ? 'decline' : 'withdraw';
}

/** Отобран автоматически и назначен без подтверждения (Верховный и Конституционный суды, spec 16/4). */
export function isAutoAppointed(application: VacancyApplication): boolean {
  return !!application.selectedBySystem && !application.responseDeadline && application.status !== 'DRAFT';
}

/** Приём заявок по вакансии (`Vacancy.isAcceptingApplications`): опубликована и сегодня в пределах дат. */
export type AcceptanceState = 'OPEN' | 'NOT_STARTED' | 'ENDED' | 'CLOSED';

/** `today` — `yyyy-MM-dd`; даты `LocalDate` сравниваются как строки. */
export function acceptanceState(vacancy: Vacancy, today: string): AcceptanceState {
  if (vacancy.status !== 'PUBLISHED') return 'CLOSED';
  if (vacancy.startDate && today < vacancy.startDate) return 'NOT_STARTED';
  if (vacancy.endDate && today > vacancy.endDate) return 'ENDED';

  return 'OPEN';
}

/** Состояние карточки вакансии для кандидата. */
export type VacancyAction = 'APPLY' | 'APPLIED' | 'OFFERED' | 'NOT_STARTED' | 'ENDED' | 'CLOSED';

export function ownApplication(
  vacancy: Vacancy,
  applications: readonly VacancyApplication[],
): VacancyApplication | undefined {
  return applications.find(
    (application) => application.vacancyId === vacancy.id && !!application.status && OCCUPYING.has(application.status),
  );
}

/**
 * Откликнуться можно на опубликованную вакансию в срок приёма, если по ней нет действующей заявки.
 * Позицию в резерве (ACTIVE, passed, срок не истёк) проверяет бэкенд: `/vacancy/available` отдаёт только такие конкурсы.
 */
export function vacancyAction(
  vacancy: Vacancy,
  applications: readonly VacancyApplication[],
  today: string,
): VacancyAction {
  const own = ownApplication(vacancy, applications);

  if (own) return own.status === 'DRAFT' ? 'OFFERED' : 'APPLIED';

  const state = acceptanceState(vacancy, today);

  return state === 'OPEN' ? 'APPLY' : state;
}

/** Свободные места: количество минус занятые (заявки во всех статусах, кроме отозванных, отклонённых и просроченных). */
export function freePlaces(vacancy: Vacancy): number {
  return Math.max(0, (vacancy.quantity ?? 0) - (vacancy.occupiedPlaces ?? 0));
}

/** Предложения, ждущие ответа кандидата, — для счётчика на вкладке. */
export function pendingOffers(applications: readonly VacancyApplication[], now: Date = new Date()): number {
  return applications.filter((application) => applicationActions(application, now).confirm).length;
}

/**
 * Кандидат в резерве судей: позиция активна или занята текущей заявкой, срок резерва не истёк.
 * Только таким кандидатам доступны вакансии (`ReserveFinder.activeContestIds`, spec 16/3).
 */
export function hasActiveReserve(reserves: readonly Reserve[]): boolean {
  return reserves.some(
    (reserve) => (reserve.status === 'ACTIVE' || reserve.status === 'SUBMITTED') && !reserve.expired,
  );
}
