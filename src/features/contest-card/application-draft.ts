import type { Schemas } from '@domain/api/api.types';

type Draft = Schemas['ApplicationDraftRequest'];
type Profile = Schemas['ProfileResponse'];
type Language = NonNullable<Draft['preferredLanguage']>;

/** Ограничения `ApplicationDraftRequest.java` (`@Size`, `@Email`). */
const MAX = { email: 255, phone: 32, address: 1000 } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: string | null | undefined, max: number): string | undefined {
  const trimmed = value?.trim();

  return trimmed && trimmed.length <= max ? trimmed : undefined;
}

/**
 * Черновик заявки при подаче: контакты — из личных данных профиля, язык — из профиля или текущий язык интерфейса.
 * Значения, которые не пройдут валидацию бэкенда (слишком длинные, некорректный e-mail), не отправляются —
 * кандидат дополнит их в мастере заявки.
 */
export function buildApplicationDraft(profile: Profile | null | undefined, fallbackLanguage: Language): Draft {
  const draft: Draft = { preferredLanguage: profile?.preferredLanguage ?? fallbackLanguage };
  const email = text(profile?.email, MAX.email);
  const homePhone = text(profile?.phoneNumber, MAX.phone);
  const homeAddress = text(profile?.actualAddress, MAX.address) ?? text(profile?.residentialAddress, MAX.address);

  if (email && EMAIL.test(email)) draft.email = email;
  if (homePhone) draft.homePhone = homePhone;
  if (homeAddress) draft.homeAddress = homeAddress;

  return draft;
}
