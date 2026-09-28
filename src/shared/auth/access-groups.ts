/** Роли бэкенда v2 (`common/security/Role.java`). Роли `JUDGE_PENDING_APPROVAL` в v2 нет. */
export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CHAIRMAN',
  'VICE_CHAIRMAN',
  'BOARD_MEMBER',
  'SECRETARY',
  'ACTIVE_JUDGE',
  'CANDIDATE',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Группы доступа — копия `AccessGroups.java` бэкенда v2 без изменений.
 * Маршрут: `canMatch: [access('BOARD')]`, шаблон: `*appAccess="'SECRETARY'"`.
 */
export const ACCESS_GROUPS = {
  ADMIN: ['SUPER_ADMIN', 'ADMIN'],
  SUPER_ADMIN: ['SUPER_ADMIN'],
  CHAIRMAN: ['CHAIRMAN', 'VICE_CHAIRMAN'],
  BOARD: ['CHAIRMAN', 'VICE_CHAIRMAN', 'BOARD_MEMBER'],
  SECRETARY: ['SECRETARY'],
  COUNCIL: ['CHAIRMAN', 'VICE_CHAIRMAN', 'BOARD_MEMBER', 'SECRETARY'],
  STAFF: ['SUPER_ADMIN', 'ADMIN', 'CHAIRMAN', 'VICE_CHAIRMAN', 'BOARD_MEMBER', 'SECRETARY'],
  CANDIDATE: ['CANDIDATE', 'ACTIVE_JUDGE'],
  ACTIVE_JUDGE: ['ACTIVE_JUDGE'],
} as const satisfies Record<string, readonly Role[]>;

/** `AUTHENTICATED` — любой вошедший пользователь. */
export type AccessGroup = keyof typeof ACCESS_GROUPS | 'AUTHENTICATED';

/** Одна группа или список групп: доступ есть, если подходит хотя бы одна. */
export type AccessRule = AccessGroup | readonly AccessGroup[];

/**
 * Проверка доступа по набору ролей пользователя.
 * @param roles роли пользователя; `null` — пользователь не вошёл.
 */
export function hasAccess(roles: readonly Role[] | null, rule: AccessRule): boolean {
  if (roles === null) return false;

  const groups: readonly AccessGroup[] = typeof rule === 'string' ? [rule] : rule;

  return groups.some((group) => {
    if (group === 'AUTHENTICATED') return true;

    const allowed: readonly Role[] = ACCESS_GROUPS[group];

    return roles.some((role) => allowed.includes(role));
  });
}
