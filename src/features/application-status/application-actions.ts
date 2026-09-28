import type { ApplicationStatus, Schemas } from '@domain/api/api.types';

export type ComplaintType = Schemas['SubmitComplaintRequest']['type'];
export type StageHint = 'TESTING' | 'ESSAY';
type History = Schemas['ApplicationStatusHistoryResponse'];

/** Финальные статусы (`ApplicationStatus.finalStatuses()`): покидаются только восстановлением по жалобе. */
export const FINAL_APPLICATION_STATUSES: ReadonlySet<ApplicationStatus> = new Set<ApplicationStatus>([
  'REJECTED_BY_BOARD',
  'TEST_FAILED',
  'NO_SHOW_TEST',
  'REJECTED_AFTER_TEST',
  'NO_SHOW_ESSAY',
  'APPROVED',
  'REJECTED_AFTER_INTERVIEW',
  'WITHDRAWN_BY_CANDIDATE',
  'CANCELLED',
]);

/** `ApplicationStatus.WITHDRAWABLE`: кандидат может отозвать заявку вплоть до собеседования. */
export const WITHDRAWABLE_STATUSES: ReadonlySet<ApplicationStatus> = new Set<ApplicationStatus>([
  'NEW',
  'PENDING_SECRETARY_REVIEW',
  'RETURNED_FOR_CORRECTION',
  'PENDING_BOARD_REVIEW',
  'APPROVED_AWAITING_TEST',
  'TEST_IN_PROGRESS',
  'PENDING_ESSAY',
  'PENDING_INTERVIEW',
]);

/** Событие `SUBMIT_FOR_REVIEW` допустимо из черновика и после возврата на доработку. */
const SUBMITTABLE: ReadonlySet<ApplicationStatus> = new Set<ApplicationStatus>(['NEW', 'RETURNED_FOR_CORRECTION']);

/**
 * Срок жалобы на этап документов по умолчанию (`ComplaintProperties.documentStageDeadlineDays`), календарные дни:
 * день N после отклонения ещё можно, N+1 — нет. Настраивается на бэкенде — окончательно проверяет он.
 */
export const DOCUMENT_COMPLAINT_DEADLINE_DAYS = 3;

export interface ApplicationActions {
  /** Мастер заявки `/cabinet/applications/:id/edit`: личное дело и контакты. */
  edit: boolean;
  /** «Отправить на рассмотрение» (`POST /contest-application/send-for-review/{id}`). */
  submit: boolean;
  /** «Отозвать заявку» (`POST /contest-application/withdraw/{id}`). */
  withdraw: boolean;
  /** Тип жалобы, который допускает статус (`ComplaintAdmissibility`), или `null`. */
  complaint: ComplaintType | null;
  /** Подсказка о входе на этап по коду секретаря. */
  stage: StageHint | null;
  final: boolean;
}

/**
 * Действия кандидата по статусу заявки — по `ApplicationStateMachine` и правилам жалоб бэкенда.
 * Жалоба на нарушения конкурса (`CONTEST_VIOLATION`) зависит от статуса конкурса, а не заявки, — здесь её нет.
 */
export function applicationActions(status: ApplicationStatus | null | undefined): ApplicationActions {
  const submittable = !!status && SUBMITTABLE.has(status);

  return {
    edit: submittable,
    submit: submittable,
    withdraw: !!status && WITHDRAWABLE_STATUSES.has(status),
    complaint: complaintTypeFor(status),
    stage: stageHintFor(status),
    final: !!status && FINAL_APPLICATION_STATUSES.has(status),
  };
}

function complaintTypeFor(status: ApplicationStatus | null | undefined): ComplaintType | null {
  if (status === 'REJECTED_BY_BOARD') return 'DOCUMENT_STAGE';
  if (status === 'TEST_FAILED' || status === 'REJECTED_AFTER_TEST') return 'TEST_RESULT';

  return null;
}

function stageHintFor(status: ApplicationStatus | null | undefined): StageHint | null {
  if (status === 'APPROVED_AWAITING_TEST' || status === 'TEST_IN_PROGRESS') return 'TESTING';
  if (status === 'PENDING_ESSAY') return 'ESSAY';

  return null;
}

/**
 * Последний день подачи жалобы на этап документов: дата последнего перехода в `REJECTED_BY_BOARD` + срок.
 * Без записи в истории — `null` (бэкенд тогда считает от сегодняшнего дня).
 */
export function documentComplaintDeadline(
  history: readonly History[],
  days = DOCUMENT_COMPLAINT_DEADLINE_DAYS,
): Date | null {
  const rejection = [...history].reverse().find((entry) => entry.to === 'REJECTED_BY_BOARD');
  const changedAt = rejection?.changedAt ? new Date(rejection.changedAt) : null;

  if (!changedAt || Number.isNaN(changedAt.getTime())) return null;

  // Дата отклонения — по времени сервера (Asia/Bishkek, UTC+6), как `atZoneSameInstant(clock.getZone())`.
  const bishkek = new Date(changedAt.getTime() + 6 * 60 * 60 * 1000);

  return new Date(bishkek.getUTCFullYear(), bishkek.getUTCMonth(), bishkek.getUTCDate() + days);
}

/** Ближайшие даты этапов заявки, которые уже назначены. */
export function stageDates(
  application: Pick<Schemas['ApplicationResponse'], 'testDate' | 'essayDate' | 'interviewDate'>,
): { stage: 'test' | 'essay' | 'interview'; date: string }[] {
  const dates = [
    { stage: 'test' as const, date: application.testDate },
    { stage: 'essay' as const, date: application.essayDate },
    { stage: 'interview' as const, date: application.interviewDate },
  ];

  return dates.filter((entry): entry is { stage: 'test' | 'essay' | 'interview'; date: string } => !!entry.date);
}
