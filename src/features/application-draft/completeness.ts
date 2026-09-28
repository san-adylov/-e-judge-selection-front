import type { Schemas } from '@domain/api/api.types';

/** Пункты правила комплектности (`ProfileCompletenessService`, §8.2 спеки); подписи — `wizard.dossier.<key>`. */
export type DossierItemKey = 'PERSONAL_DATA' | 'PERSONAL_FILE' | 'EDUCATION' | 'EMPLOYMENT';

export interface DossierItem {
  key: DossierItemKey;
  done: boolean;
}

export interface DossierSnapshot {
  /** `null` — личные данные ещё не созданы (`GET /candidate/profile` → 4041). */
  profile: Schemas['ProfileResponse'] | null;
  educationCount: number;
  employmentCount: number;
}

/**
 * Та же проверка, что делает бэкенд при отправке (ошибка 4137): личные данные с файлом персональной
 * информации, минимум одна запись об образовании и одна о трудовой деятельности.
 */
export function dossierItems(snapshot: DossierSnapshot): DossierItem[] {
  const { profile } = snapshot;

  return [
    { key: 'PERSONAL_DATA', done: profile !== null },
    { key: 'PERSONAL_FILE', done: profile?.fileId != null },
    { key: 'EDUCATION', done: snapshot.educationCount > 0 },
    { key: 'EMPLOYMENT', done: snapshot.employmentCount > 0 },
  ];
}

export function dossierComplete(snapshot: DossierSnapshot): boolean {
  return dossierItems(snapshot).every((item) => item.done);
}
