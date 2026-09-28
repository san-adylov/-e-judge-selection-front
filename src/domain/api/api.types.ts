import { HttpParams } from '@angular/common/http';

import type { components as ApiComponents } from './api.schema';
import type { components as AuthComponents } from './auth.schema';

/** Схемы api-service и audit-service (`/docs/api/v3/api-docs`). */
export type Schemas = ApiComponents['schemas'];
/** Схемы auth-service (`/docs/auth/v3/api-docs`). */
export type AuthSchemas = AuthComponents['schemas'];

/** `PageResponse` бэкенда v2. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/** Spring `Pageable`: `page` с нуля, `size` по умолчанию 20, `sort=field,asc|desc`. */
export interface PageQuery {
  page?: number;
  size?: number;
  sort?: string | string[];
}

type QueryValue = string | number | boolean | null | undefined | readonly (string | number | boolean)[];

/** Пустые значения (`null`, `undefined`, `''`) не попадают в запрос; массивы — повтором параметра. */
export function toParams(query: object = {}): HttpParams {
  let params = new HttpParams();

  for (const [key, value] of Object.entries(query) as [string, QueryValue][]) {
    if (value === null || value === undefined || value === '') continue;

    const values: readonly (string | number | boolean)[] = Array.isArray(value) ? value : [value as string];

    values.forEach((item) => (params = params.append(key, String(item))));
  }

  return params;
}

/** Enum в пути запроса — точное имя в верхнем регистре; kebab-case бэкенд не принимает. */
export const PROFILE_SECTIONS = [
  'EDUCATION',
  'ACADEMIC_DEGREE',
  'CERTIFICATE',
  'EMPLOYMENT',
  'AWARD',
  'RELATIVE',
  'ASSET',
  'ADDITIONAL_INFO',
  'DOCUMENT',
] as const;

/** `PERSONAL_DATA` идёт через `/v1/candidate/profile`, а не через разделы. */
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const DIRECTORY_CODES = [
  'COUNTRY',
  'CITIZENSHIP',
  'NATIONALITY',
  'REGION',
  'DISTRICT',
  'CITY',
  'STREET',
  'POSTAL_CODE',
  'COURT',
  'COURT_NAME',
  'COURT_INSTANCE',
  'COURT_INSTANCE_TYPE',
  'SPECIALIZATION',
  'UNIVERSITY',
  'STUDY_FORM',
  'EDUCATION_DEGREE',
  'LANGUAGE_LEVEL',
  'EMPLOYMENT_TYPE',
  'DOCUMENT_TYPE',
  'ASSET_TYPE',
  'EXCLUSION_REASON',
  'AGE_REQUIREMENT',
  'EDUCATION_REQUIREMENT',
  'WORK_EXPERIENCE_REQUIREMENT',
] as const;

export type DirectoryCode = (typeof DIRECTORY_CODES)[number];

export type StageKind = 'TESTING' | 'ESSAY' | 'INTERVIEW';

export type ApplicationStatus = NonNullable<Schemas['ApplicationResponse']['status']>;
export type VisibleStatus = NonNullable<Schemas['ContestCardResponse']['visibleStatus']>;
export type ContestStatus = NonNullable<Schemas['ContestResponse']['status']>;
export type ContestType = NonNullable<Schemas['ContestResponse']['type']>;
export type MeetingType = Schemas['ScheduleMeetingRequest']['type'];
export type MeetingStatus = NonNullable<Schemas['MeetingResponse']['status']>;
export type FileCategory = NonNullable<Schemas['StoredFileRef']['category']>;
export type NotificationType = NonNullable<Schemas['NotificationResponse']['type']>;
export type AssessmentSection = Schemas['DocumentScore']['section'];
export type AuthRole = NonNullable<AuthSchemas['UserResponse']['role']>;
export type UserStatus = NonNullable<AuthSchemas['UserResponse']['status']>;
