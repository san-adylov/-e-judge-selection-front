import type { Schemas } from '@domain/api/api.types';
import { hasAccess, type Role } from '@shared/auth/access-groups';

export type Vacancy = Schemas['VacancyResponse'];
export type VacancyStatus = NonNullable<Vacancy['status']>;
export type VacancyApplication = Schemas['VacancyApplicationResponse'];

export const VACANCIES_URL = '/administrative/vacancies';

export const VACANCY_STATUSES: readonly VacancyStatus[] = [
  'DRAFT',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'REVIEW',
  'CLOSED',
  'CANCELLED',
];

const FINAL: ReadonlySet<VacancyStatus> = new Set(['CLOSED', 'CANCELLED']);

export interface VacancyActions {
  /** `PATCH /vacancy/{id}` — секретарь, пока вакансия черновик или готова к публикации. */
  edit: boolean;
  /** `POST /vacancy/{id}/publish` — секретарь, после одобрения заседанием (`READY_TO_PUBLISH`). */
  publish: boolean;
  /** `POST /vacancy/{id}/cancel` — председатель, из любого неконечного статуса. */
  cancel: boolean;
  /** `POST /vacancy/{id}/meeting` — председатель; нужны поданные отклики (4xxx `NO_VACANCY_APPLICATIONS`). */
  scheduleMeeting: boolean;
  /** `POST /vacancy/{id}/select-from-reserve` — секретарь, по опубликованной вакансии. */
  selectFromReserve: boolean;
}

export function vacancyActions(vacancy: Vacancy, roles: readonly Role[], submitted: number): VacancyActions {
  const status = vacancy.status;
  const final = !!status && FINAL.has(status);
  const secretary = hasAccess(roles, 'SECRETARY');
  const chairman = hasAccess(roles, 'CHAIRMAN');

  return {
    edit: secretary && (status === 'DRAFT' || status === 'READY_TO_PUBLISH'),
    publish: secretary && status === 'READY_TO_PUBLISH',
    cancel: chairman && !!status && !final,
    scheduleMeeting: chairman && (status === 'PUBLISHED' || status === 'REVIEW') && submitted > 0,
    selectFromReserve: secretary && (status === 'PUBLISHED' || status === 'REVIEW'),
  };
}

export interface VacancyApplicationActions {
  /** `POST /vacancy-application/{id}/sunush` — сотрудник, по одобренному отклику без представления (4107 при повторе). */
  generateSunush: boolean;
  /** `POST /vacancy-application/{id}/sunush/confirm` — сотрудник, когда представление сформировано. */
  confirmSunush: boolean;
}

export function vacancyApplicationActions(application: VacancyApplication): VacancyApplicationActions {
  const approved = application.status === 'APPROVED';
  const hasSunush = application.sunushFileId !== undefined && application.sunushFileId !== null;

  return {
    generateSunush: approved && !hasSunush,
    confirmSunush: approved && hasSunush && application.sunushConfirmed !== true,
  };
}

export function freePlaces(vacancy: Vacancy): number {
  return Math.max(0, (vacancy.quantity ?? 0) - (vacancy.occupiedPlaces ?? 0));
}
