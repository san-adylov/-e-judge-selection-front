/** `AuditEntityType.java` — объекты журнала аудита. */
export const AUDIT_ENTITY_TYPES = [
  'AUTH',
  'USER',
  'PROFILE',
  'PROFILE_SECTION',
  'ADDITIONAL_INFO',
  'APPLICATION',
  'CONTEST',
  'QUESTION_BANK',
  'TEST',
  'ESSAY',
  'MEETING',
  'VOTE',
  'INTERVIEW',
  'DOCUMENT_ASSESSMENT',
  'COMPLAINT',
  'DECISION',
  'DOCUMENT',
  'FILE',
  'SIGNATURE',
  'JUDGE_CONFIRMATION',
  'JUDGE_APPLICATION',
  'VACANCY',
  'VACANCY_APPLICATION',
  'RESERVE',
  'NOTIFICATION',
  'DIRECTORY',
  'HOLIDAY',
  'SETTINGS',
  'REFERENCE_DOCUMENT',
] as const;

/** `AuditActionType.java` — вид действия. */
export const AUDIT_ACTION_TYPES = [
  'LOGIN',
  'LOGOUT',
  'REGISTRATION',
  'VIEW',
  'SAVE',
  'UPDATE',
  'DELETE',
  'EXPORT',
  'IMPORT',
  'PRINT',
  'PROCESS',
  'CONFIGURE',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];

/** Фильтр по событию: код `AuditEvent` вводится текстом — их больше ста, и список растёт с бэкендом. */
export function normalizeEventType(value: string): string | undefined {
  const code = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  return /^[A-Z][A-Z0-9_]*$/.test(code) ? code : undefined;
}
