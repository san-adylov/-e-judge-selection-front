import type { ProfileResponse } from './personal-data.mapping';

/** Разделы, без которых заявку не отправить (ошибка 4137, `ProfileCompletenessService` бэкенда). */
export const MANDATORY_SECTIONS = ['PERSONAL_DATA', 'EDUCATION', 'EMPLOYMENT'] as const;

export type MandatorySection = (typeof MANDATORY_SECTIONS)[number];

/**
 * `loading` — данные ещё не пришли; `missing` — раздел не заполнен; `no-file` — личные данные есть,
 * но нет файла персональной информации (`fileId`), бэкенд считает это отдельным недостающим пунктом.
 */
export type CompletenessState = 'loading' | 'done' | 'missing' | 'no-file';

export interface CompletenessItem {
  section: MandatorySection;
  state: CompletenessState;
}

export interface CompletenessInput {
  /** `undefined` — загружается, `null` — личных данных нет (404). */
  profile: ProfileResponse | null | undefined;
  /** Число активных записей раздела; `undefined` — загружается. */
  education: number | undefined;
  employment: number | undefined;
}

export interface Completeness {
  items: CompletenessItem[];
  loading: boolean;
  complete: boolean;
}

function personalState(profile: ProfileResponse | null | undefined): CompletenessState {
  if (profile === undefined) return 'loading';
  if (profile === null) return 'missing';

  return profile.fileId ? 'done' : 'no-file';
}

function recordsState(count: number | undefined): CompletenessState {
  if (count === undefined) return 'loading';

  return count > 0 ? 'done' : 'missing';
}

/** Правило §8.2 спеки: личные данные с файлом, ≥1 запись об образовании и ≥1 о трудовой деятельности. */
export function profileCompleteness(input: CompletenessInput): Completeness {
  const items: CompletenessItem[] = [
    { section: 'PERSONAL_DATA', state: personalState(input.profile) },
    { section: 'EDUCATION', state: recordsState(input.education) },
    { section: 'EMPLOYMENT', state: recordsState(input.employment) },
  ];

  return {
    items,
    loading: items.some((item) => item.state === 'loading'),
    complete: items.every((item) => item.state === 'done'),
  };
}
