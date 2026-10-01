import type { AssessmentSection, MeetingType, Schemas } from '@domain/api/api.types';
import { hasAccess, type Role } from '@shared/auth/access-groups';

export type JudgeApplication = Schemas['JudgeApplicationResponse'];
export type JudgeStatus = NonNullable<JudgeApplication['status']>;
export type Confirmation = Schemas['JudgeConfirmationResponse'];
export type ConfirmationStatus = NonNullable<Confirmation['status']>;

export const JUDGES_URL = '/administrative/judges';

export const JUDGE_STATUSES: readonly JudgeStatus[] = [
  'DRAFT',
  'PENDING_SECRETARY_REVIEW',
  'REGISTERED',
  'PENDING_DOCUMENT_REVIEW',
  'REJECTED_AFTER_DOCUMENT_REVIEW',
  'APPROVED_AFTER_DOCUMENT_REVIEW',
  'PENDING_ASSESSMENT_APPROVAL',
  'REJECTED_ASSESSMENT_APPROVAL',
  'APPROVED_ASSESSMENT_APPROVAL',
  'PENDING_INTERVIEW',
  'REJECTED_AFTER_INTERVIEW',
  'APPROVED_AFTER_INTERVIEW',
];

export const CONFIRMATION_STATUSES: readonly ConfirmationStatus[] = [
  'CREATED',
  'PENDING_SECRETARY_REVIEW',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
];

const FINAL: ReadonlySet<JudgeStatus> = new Set([
  'REJECTED_AFTER_DOCUMENT_REVIEW',
  'REJECTED_ASSESSMENT_APPROVAL',
  'REJECTED_AFTER_INTERVIEW',
  'APPROVED_AFTER_INTERVIEW',
]);

/** Максимум профессиональной оценки (`tandoo.scoring.professionalAssessmentMaxScore`, по умолчанию 100). */
export const PROFESSIONAL_MAX_SCORE = 100;

/** Разделы документов судьи с максимумами (`AssessmentSection.judgeMax`, сумма 31). */
export const JUDGE_SECTIONS: readonly { section: AssessmentSection; max: number }[] = [
  { section: 'IMPECCABILITY', max: 6 },
  { section: 'ADDITIONAL_LOAD', max: 3 },
  { section: 'TAX_DECLARATION', max: 2 },
  { section: 'QUALIFICATION_CLASS', max: 3 },
  { section: 'ACADEMIC_DEGREE', max: 4 },
  { section: 'CERTIFICATES', max: 4 },
  { section: 'JUDGE_WORK_QUALITY_1', max: 4 },
  { section: 'JUDGE_WORK_QUALITY_2', max: 4 },
  { section: 'PERSONAL_DATA', max: 1 },
];

/** Следующее заседание трека судьи по статусу (`JudgeApplicationStateMachine.stageEventsFor`). */
export function nextJudgeMeeting(status: JudgeStatus | undefined): MeetingType | null {
  switch (status) {
    case 'REGISTERED':
      return 'JUDGE_DOCUMENT_REVIEW';
    case 'APPROVED_AFTER_DOCUMENT_REVIEW':
      return 'PROFESSIONAL_ASSESSMENT_APPROVAL';
    case 'APPROVED_ASSESSMENT_APPROVAL':
      return 'JUDGE_INTERVIEW';
    default:
      return null;
  }
}

export interface JudgeActions {
  /** `PUT /judge-applications/{id}/register` — секретарь, из `PENDING_SECRETARY_REVIEW`. */
  register: boolean;
  /** `PUT /judge-applications/{id}/reporter` — председатель, пока заявка не завершена. */
  reassign: boolean;
  /** `PATCH /judge-applications/{id}/ready` — назначенный докладчик. */
  ready: boolean;
  /** `PUT /judge-applications/{id}/document-score` — докладчик, пока заявка не завершена. */
  documentScore: boolean;
  /** `PUT /judge-applications/{id}/professional-score` — член Совета, пока заявка не завершена. */
  professionalScore: boolean;
  /** `POST /judge-applications/{id}/files` — секретарь. */
  attachFile: boolean;
  /** `POST /judge-applications/{id}/meetings` — Совет; тип — по статусу. */
  scheduleMeeting: MeetingType | null;
  /** `POST /judge-applications/{id}/invite-interview` — секретарь, когда судья ждёт собеседования. */
  invite: boolean;
}

export function judgeActions(
  application: Pick<JudgeApplication, 'status' | 'reporterId'>,
  actor: { roles: readonly Role[]; userId: number },
): JudgeActions {
  const status = application.status;
  const final = !!status && FINAL.has(status);
  const active = !!status && status !== 'DRAFT' && !final;
  const reporter = application.reporterId === actor.userId;
  const board = hasAccess(actor.roles, 'BOARD');
  const secretary = hasAccess(actor.roles, 'SECRETARY');

  return {
    register: secretary && status === 'PENDING_SECRETARY_REVIEW',
    reassign: hasAccess(actor.roles, 'CHAIRMAN') && active && status !== 'PENDING_SECRETARY_REVIEW',
    ready: board && reporter && active,
    documentScore: board && reporter && active,
    professionalScore: board && active,
    attachFile: secretary && !final,
    scheduleMeeting: hasAccess(actor.roles, 'COUNCIL') ? nextJudgeMeeting(status) : null,
    invite: secretary && status === 'PENDING_INTERVIEW',
  };
}

export interface ConfirmationActions {
  /** `POST /active-judge-confirmations/{id}/review` — взять в работу. */
  review: boolean;
  /** `approve` / `reject` — из `UNDER_REVIEW`. */
  decide: boolean;
}

export function confirmationActions(
  status: ConfirmationStatus | undefined,
  roles: readonly Role[],
): ConfirmationActions {
  const secretary = hasAccess(roles, 'SECRETARY');

  return { review: secretary && status === 'PENDING_SECRETARY_REVIEW', decide: secretary && status === 'UNDER_REVIEW' };
}
