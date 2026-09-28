import type { Language } from '../auth/auth.models';

export type UiLang = 'ru' | 'kg';

/** `user.language` бэкенда (RU | KG | EN) → язык интерфейса; английского словаря нет. */
export function uiLangOf(language: Language | null | undefined): UiLang {
  return language === 'KG' ? 'kg' : 'ru';
}

export function backendLangOf(lang: string): Language {
  return lang === 'kg' || lang === 'ky' ? 'KG' : 'RU';
}

/** Поле с вариантами `…Ru` / `…Kg`: берёт вариант текущего языка, иначе русский. */
export function localized(ru: string | null | undefined, kg: string | null | undefined, lang: string): string {
  return (lang === 'kg' || lang === 'ky' ? kg || ru : ru || kg) ?? '';
}
