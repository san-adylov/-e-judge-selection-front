import type { MeetingStatus, MeetingType, Schemas } from '@domain/api/api.types';
import { hasAccess, type Role } from '@shared/auth/access-groups';

export type Meeting = Schemas['MeetingResponse'];
export type Decision = Schemas['DecisionResponse'];
export type DecisionStatus = NonNullable<Decision['status']>;

export const MEETINGS_URL = '/administrative/meetings';

export const MEETING_STATUSES: readonly MeetingStatus[] = ['APPOINTED', 'OPENED', 'APPROVED', 'DECLINED'];

/** Заседания этапов конкурса в порядке этапов (`MeetingType.CONTEST_STAGES`); назначаются с экрана заседаний. */
export const CONTEST_STAGE_TYPES: readonly MeetingType[] = [
  'OPEN_COMPETITION',
  'DOCUMENT_REVIEW',
  'CALENDAR_APPROVAL',
  'INTERVIEW',
  'CLOSE_COMPETITION',
];

/** Закрываются вручную (`Closing.MANUAL`): «Закрыть заседание» при хотя бы одном голосе. */
const MANUALLY_CLOSED: ReadonlySet<MeetingType> = new Set([
  'COMPLAINT_REVIEW',
  'JUDGE_DOCUMENT_REVIEW',
  'JUDGE_INTERVIEW',
]);

/** Что является предметом голоса (`MeetingType.Subject`). */
export type SubjectKind =
  'CONTEST_AGENDA' | 'APPLICATION' | 'COMPLAINT' | 'JUDGE_APPLICATION' | 'VACANCY_AGENDA' | 'VACANCY_APPLICATION';

export function subjectKind(type: MeetingType | undefined): SubjectKind | null {
  switch (type) {
    case 'OPEN_COMPETITION':
    case 'CALENDAR_APPROVAL':
    case 'CLOSE_COMPETITION':
      return 'CONTEST_AGENDA';
    case 'DOCUMENT_REVIEW':
    case 'INTERVIEW':
      return 'APPLICATION';
    case 'COMPLAINT_REVIEW':
      return 'COMPLAINT';
    case 'JUDGE_DOCUMENT_REVIEW':
    case 'PROFESSIONAL_ASSESSMENT_APPROVAL':
    case 'JUDGE_INTERVIEW':
      return 'JUDGE_APPLICATION';
    case 'CREATE_VACANCY':
      return 'VACANCY_AGENDA';
    case 'CANDIDATE_APPROVAL':
      return 'VACANCY_APPLICATION';
    default:
      return null;
  }
}

/** Единственный предмет повестки: конкурс или вакансия (`Meeting.agendaSubjectId`). */
export function agendaSubjectId(meeting: Meeting): number | null {
  const kind = subjectKind(meeting.type);

  if (kind === 'CONTEST_AGENDA') return meeting.contestId ?? null;
  if (kind === 'VACANCY_AGENDA') return meeting.vacancyId ?? null;

  return null;
}

export function isFinalMeeting(status: MeetingStatus | undefined): boolean {
  return status === 'APPROVED' || status === 'DECLINED';
}

export function isParticipant(meeting: Meeting, userId: number | undefined): boolean {
  return userId !== undefined && (meeting.participants ?? []).some((participant) => participant.userId === userId);
}

export interface MeetingActions {
  /** `POST /meeting/{id}/join` — Совет, пока заседание не завершено и пользователь ещё не участник. */
  join: boolean;
  /** `PUT /meeting/{id}/force-close` — Совет (BOARD), только вручную закрываемые типы, открытое заседание. */
  forceClose: boolean;
  /** `PATCH /meeting/{id}` — председатель, пока не завершено. */
  reschedule: boolean;
  /** `POST /vote` — участник открытого заседания с ролью Совета (BOARD). */
  vote: boolean;
}

export function meetingActions(meeting: Meeting, actor: { roles: readonly Role[]; userId: number }): MeetingActions {
  const final = isFinalMeeting(meeting.status);
  const opened = meeting.status === 'OPENED';
  const participant = isParticipant(meeting, actor.userId);
  const board = hasAccess(actor.roles, 'BOARD');

  return {
    join: hasAccess(actor.roles, 'COUNCIL') && !final && !participant,
    forceClose: board && opened && !!meeting.type && MANUALLY_CLOSED.has(meeting.type),
    reschedule: hasAccess(actor.roles, 'CHAIRMAN') && !final,
    vote: board && opened && participant,
  };
}

export const VOTE_REASON_MAX = 2000;

export interface DecisionActions {
  /** `POST /decision/{id}/generate` — секретарь, пока файла нет (4067 — не все проголосовали). */
  generate: boolean;
  /** `POST /decision/{id}/confirm` — председатель, после формирования файла. */
  confirm: boolean;
  /** `POST /oep/sign` — член Совета; у решения уже есть файл. */
  sign: boolean;
  download: boolean;
}

export function decisionActions(decision: Decision, roles: readonly Role[]): DecisionActions {
  const hasFile = decision.fileId !== undefined && decision.fileId !== null;

  return {
    generate: hasAccess(roles, 'SECRETARY') && decision.status === 'PENDING',
    confirm: hasAccess(roles, 'CHAIRMAN') && decision.status === 'GENERATED',
    sign: hasAccess(roles, 'COUNCIL') && hasFile && decision.status !== 'SIGNED',
    download: hasFile,
  };
}

/** Контекст подписи ОЭП решения: по заявке, по заявке судьи или по повестке (`SignatureService.subjectOf`). */
export function decisionSignContext(decision: Decision): Schemas['SignRequest'] {
  return {
    meetingId: decision.meetingId,
    applicationId: decision.applicationId ?? undefined,
    judgeApplicationId: decision.judgeApplicationId ?? undefined,
  };
}
