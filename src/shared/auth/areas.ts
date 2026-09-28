import { hasAccess, type Role } from './access-groups';
import type { Session } from './auth.models';

/**
 * Префиксы URL не меняются с v1: на них завязаны закладки, ссылки в уведомлениях
 * и адрес возврата из ЕСИА (`/cabinet/sign-in`).
 */
export const AREAS = {
  cabinet: '/cabinet',
  administrative: '/administrative',
  testing: '/testing',
} as const;

export type Area = keyof typeof AREAS;

export const SIGN_IN_URLS: Record<Area, string> = {
  cabinet: `${AREAS.cabinet}/sign-in`,
  administrative: `${AREAS.administrative}/sign-in`,
  testing: `${AREAS.testing}/sign-in`,
};

export const FORBIDDEN_URL = '/forbidden';

export function areaOf(url: string): Area {
  if (url.startsWith(AREAS.administrative)) return 'administrative';
  if (url.startsWith(AREAS.testing)) return 'testing';

  return 'cabinet';
}

export function signInUrlFor(url: string): string {
  return SIGN_IN_URLS[areaOf(url)];
}

/** `returnUrl` из query — только внутренний путь приложения, иначе открытый редирект. */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;

  return Object.values(SIGN_IN_URLS).some((url) => value.startsWith(url)) ? null : value;
}

/**
 * Корневой редирект: токен этапа → тестирование; есть `STAFF` → `/administrative`;
 * иначе `/cabinet`. При обеих группах в шапке есть переключатель.
 */
export function homeUrl(session: Session | null): string {
  if (!session) return SIGN_IN_URLS.cabinet;

  if (session.stage) {
    return session.stage.exerciseType === 'TEST'
      ? `${AREAS.testing}/quiz/${session.stage.exerciseId}`
      : `${AREAS.testing}/essay`;
  }

  const roles: readonly Role[] = session.user.roles;

  if (hasAccess(roles, 'STAFF')) return AREAS.administrative;
  if (hasAccess(roles, 'CANDIDATE')) return AREAS.cabinet;

  return FORBIDDEN_URL;
}
