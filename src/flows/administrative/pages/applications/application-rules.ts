import type { ApplicationStatus, Schemas } from '@domain/api/api.types';
import { hasAccess, type Role } from '@shared/auth/access-groups';

export type Application = Schemas['ApplicationResponse'];

export const APPLICATIONS_URL = '/administrative/applications';

/** Все статусы заявки в порядке жизненного цикла (`ApplicationStatus.java`). */
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'NEW',
  'PENDING_SECRETARY_REVIEW',
  'RETURNED_FOR_CORRECTION',
  'PENDING_BOARD_REVIEW',
  'REJECTED_BY_BOARD',
  'APPROVED_AWAITING_TEST',
  'TEST_IN_PROGRESS',
  'TEST_FAILED',
  'NO_SHOW_TEST',
  'REJECTED_AFTER_TEST',
  'PENDING_ESSAY',
  'NO_SHOW_ESSAY',
  'PENDING_INTERVIEW',
  'APPROVED',
  'REJECTED_AFTER_INTERVIEW',
  'WITHDRAWN_BY_CANDIDATE',
  'CANCELLED',
];

/** По умолчанию — всё, кроме черновиков: их видит только кандидат (как `for-secretary`). */
export const DEFAULT_STATUSES: readonly ApplicationStatus[] = APPLICATION_STATUSES.filter((status) => status !== 'NEW');

export interface StaffApplicationActions {
  /** `PUT /register/{id}` — секретарь, из `PENDING_SECRETARY_REVIEW`; докладчик назначается автоматически. */
  register: boolean;
  /** `PUT /returned-for-correction/{id}` — секретарь, из `PENDING_SECRETARY_REVIEW`, с причиной. */
  returnForCorrection: boolean;
  /** `PUT /assign-board-member/{id}` — председатель, пока заявка у Совета (`PENDING_BOARD_REVIEW`). */
  reassign: boolean;
  /** `PATCH /{id}/ready` — только назначенный докладчик, пока заявка у Совета. */
  ready: boolean;
  /** `POST /canceled/{id}` — администратор, из `NEW` и `PENDING_SECRETARY_REVIEW` (`ApplicationStateMachine`). */
  cancel: boolean;
}

export interface Actor {
  roles: readonly Role[];
  userId: number;
}

/** Действия сотрудника над заявкой — по роли, статусу и назначенному докладчику. */
export function staffApplicationActions(
  application: Pick<Application, 'status' | 'reporterId'>,
  actor: Actor,
): StaffApplicationActions {
  const status = application.status;
  const atSecretary = status === 'PENDING_SECRETARY_REVIEW';
  const atBoard = status === 'PENDING_BOARD_REVIEW';
  const secretary = hasAccess(actor.roles, 'SECRETARY');

  return {
    register: secretary && atSecretary,
    returnForCorrection: secretary && atSecretary,
    reassign: hasAccess(actor.roles, 'CHAIRMAN') && atBoard,
    ready: hasAccess(actor.roles, 'BOARD') && atBoard && application.reporterId === actor.userId,
    cancel: hasAccess(actor.roles, 'ADMIN') && (status === 'NEW' || atSecretary),
  };
}

export const RETURN_REASON_MAX = 4000;
