import type { Schemas } from '@domain/api/api.types';
import { parseLocalDate, toLocalDate } from '@shared/lib/dates';

export type ProfileRequest = Schemas['ProfileRequest'];
export type ProfileResponse = Schemas['ProfileResponse'];
export type Gender = ProfileRequest['gender'];
export type MaritalStatus = NonNullable<ProfileRequest['maritalStatus']>;
export type PreferredLanguage = NonNullable<ProfileRequest['preferredLanguage']>;

export const GENDERS: readonly Gender[] = ['MALE', 'FEMALE'];
export const MARITAL_STATUSES: readonly MaritalStatus[] = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];
export const PREFERRED_LANGUAGES: readonly PreferredLanguage[] = ['RU', 'KG', 'EN'];

/** Значение формы личных данных: даты — `Date` (p-datepicker), пустые строки и `null` в запрос не попадают. */
export interface PersonalDataFormValue {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: Date | null;
  gender: Gender | null;
  citizenshipId: number | null;
  nationalityId: number | null;
  maritalStatus: MaritalStatus | null;
  birthPlace: string;
  phoneNumber: string;
  additionalPhoneNumber: string;
  email: string;
  additionalEmail: string;
  regionId: number | null;
  districtId: number | null;
  cityId: number | null;
  streetId: number | null;
  postalCode: string;
  residentialAddress: string;
  actualAddress: string;
  preferredLanguage: PreferredLanguage | null;
  fileId: number | null;
  additionalInformation: string;
}

type TextKey = {
  [K in keyof PersonalDataFormValue]: PersonalDataFormValue[K] extends string ? K : never;
}[keyof PersonalDataFormValue];

const TEXT_KEYS: readonly TextKey[] = [
  'lastName',
  'firstName',
  'middleName',
  'birthPlace',
  'phoneNumber',
  'additionalPhoneNumber',
  'email',
  'additionalEmail',
  'postalCode',
  'residentialAddress',
  'actualAddress',
  'additionalInformation',
];

const ID_KEYS = ['citizenshipId', 'nationalityId', 'regionId', 'districtId', 'cityId', 'streetId', 'fileId'] as const;

export function emptyPersonalData(): PersonalDataFormValue {
  return {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: null,
    gender: null,
    citizenshipId: null,
    nationalityId: null,
    maritalStatus: null,
    birthPlace: '',
    phoneNumber: '',
    additionalPhoneNumber: '',
    email: '',
    additionalEmail: '',
    regionId: null,
    districtId: null,
    cityId: null,
    streetId: null,
    postalCode: '',
    residentialAddress: '',
    actualAddress: '',
    preferredLanguage: null,
    fileId: null,
    additionalInformation: '',
  };
}

/** «Фамилия Имя Отчество» из сессии (ЕСИА) → поля ФИО для первого заполнения. */
export function splitFullName(
  fullName: string | null | undefined,
): Pick<PersonalDataFormValue, 'lastName' | 'firstName' | 'middleName'> {
  const [lastName = '', firstName = '', ...rest] = (fullName ?? '').trim().split(/\s+/).filter(Boolean);

  return { lastName, firstName, middleName: rest.join(' ') };
}

/** Ответ бэкенда → форма. Без профиля — пустая форма с ФИО из сессии. */
export function profileToForm(profile: ProfileResponse | null, fullName?: string | null): PersonalDataFormValue {
  const value = emptyPersonalData();

  if (!profile) return { ...value, ...splitFullName(fullName) };

  for (const key of TEXT_KEYS) value[key] = profile[key] ?? '';
  for (const key of ID_KEYS) value[key] = profile[key] ?? null;

  return {
    ...value,
    birthDate: parseLocalDate(profile.birthDate),
    gender: profile.gender ?? null,
    maritalStatus: profile.maritalStatus ?? null,
    preferredLanguage: profile.preferredLanguage ?? null,
  };
}

/**
 * Форма → `ProfileRequest`. Строки обрезаются, пустые значения не отправляются: `PUT` заменяет запись целиком,
 * отсутствующее поле на бэкенде = `null`. ПИН в запрос не входит — бэкенд берёт его из учётной записи.
 * Вызывается после проверки формы: ФИО, дата рождения и пол уже заполнены.
 */
export function formToRequest(value: PersonalDataFormValue): ProfileRequest {
  const request: Record<string, unknown> = {};

  for (const key of TEXT_KEYS) {
    const text = value[key].trim();

    if (text) request[key] = text;
  }

  for (const key of ID_KEYS) {
    if (value[key] !== null) request[key] = value[key];
  }

  if (value.birthDate) request['birthDate'] = toLocalDate(value.birthDate);
  if (value.gender) request['gender'] = value.gender;
  if (value.maritalStatus) request['maritalStatus'] = value.maritalStatus;
  if (value.preferredLanguage) request['preferredLanguage'] = value.preferredLanguage;

  return request as ProfileRequest;
}
