import type { ContestStatus, MeetingType, Schemas } from '@domain/api/api.types';

export type Contest = Schemas['ContestResponse'];

export const CONTESTS_URL = '/administrative/contests';

/** Все статусы конкурса в порядке жизненного цикла (`ContestStatus.java`). */
export const CONTEST_STATUSES: readonly ContestStatus[] = [
  'CREATED',
  'PENDING_OPENING',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'PENDING_DOCUMENT_REVIEW',
  'DOCUMENT_REVIEW_APPROVED',
  'PENDING_CALENDAR_APPROVAL',
  'CALENDAR_APPROVED',
  'PENDING_INTERVIEW',
  'INTERVIEW_COMPLETED',
  'PENDING_CLOSURE',
  'COMPLETED',
  'CANCELLED',
];

const FINAL: ReadonlySet<ContestStatus> = new Set(['COMPLETED', 'CANCELLED']);

/** Конечное состояние: править, публиковать и отменять уже нельзя (`ContestStatus.FINAL`). */
export function isFinal(status: ContestStatus | undefined): boolean {
  return status !== undefined && FINAL.has(status);
}

/** Секретарь публикует только после утверждения открытия Советом (`READY_TO_PUBLISH --PUBLISH--> PUBLISHED`). */
export function canPublish(status: ContestStatus | undefined): boolean {
  return status === 'READY_TO_PUBLISH';
}

/** Председатель отменяет из любого неконечного состояния. */
export function canCancel(status: ContestStatus | undefined): boolean {
  return status !== undefined && !isFinal(status);
}

/** Секретарь редактирует данные до конечного состояния (`ContestEditorService.requireEditable`). */
export function canEdit(status: ContestStatus | undefined): boolean {
  return status !== undefined && !isFinal(status);
}

/**
 * Какое заседание этапа продвигает конкурс из текущего статуса (`ContestStateMachine`):
 * его назначение переводит конкурс в `PENDING_*`, утверждение — на следующий этап.
 */
export function nextStageMeeting(status: ContestStatus | undefined): MeetingType | null {
  switch (status) {
    case 'CREATED':
      return 'OPEN_COMPETITION';
    case 'PUBLISHED':
      return 'DOCUMENT_REVIEW';
    case 'DOCUMENT_REVIEW_APPROVED':
      return 'CALENDAR_APPROVAL';
    case 'CALENDAR_APPROVED':
      return 'INTERVIEW';
    case 'INTERVIEW_COMPLETED':
      return 'CLOSE_COMPETITION';
    default:
      return null;
  }
}

/** Статусы, в которых конкурс ждёт решения уже назначенного заседания. */
export function isPendingMeeting(status: ContestStatus | undefined): boolean {
  return status !== undefined && status.startsWith('PENDING_');
}

export type PublicationField =
  'startDate' | 'documentAcceptanceEndDate' | 'vacantPlaces' | 'type' | 'questionCategories';

/** Поля, без которых бэкенд откажет в публикации (`Contest.missingForPublication`). */
export function missingForPublication(contest: Contest): PublicationField[] {
  const missing: PublicationField[] = [];

  if (!contest.startDate) missing.push('startDate');
  if (!contest.documentAcceptanceEndDate) missing.push('documentAcceptanceEndDate');
  if (!contest.vacantPlaces || contest.vacantPlaces <= 0) missing.push('vacantPlaces');
  if (!contest.type) missing.push('type');
  if (!contest.questionCategories?.length) missing.push('questionCategories');

  return missing;
}
