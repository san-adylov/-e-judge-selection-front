import { DIRECTORY_CODES, type DirectoryCode } from '@domain/api/api.types';

/** Справочники из внешнего источника (`DirectoryCode.externalSource`): правятся только синхронизацией. */
const EXTERNAL: ReadonlySet<DirectoryCode> = new Set<DirectoryCode>([
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
]);

/** Родительский справочник иерархических кодов (`DirectoryCode.hierarchical`: регион → район → город → улица). */
export const PARENT_CODE: Partial<Record<DirectoryCode, DirectoryCode>> = {
  DISTRICT: 'REGION',
  CITY: 'DISTRICT',
  STREET: 'CITY',
  POSTAL_CODE: 'CITY',
  COURT_NAME: 'COURT',
};

export const ALL_DIRECTORY_CODES: readonly DirectoryCode[] = DIRECTORY_CODES;

export function isExternal(code: DirectoryCode): boolean {
  return EXTERNAL.has(code);
}

/** Создание и правка записей — только у локальных справочников (`DirectoryService.requireAdminManaged`). */
export function isEditable(code: DirectoryCode): boolean {
  return !EXTERNAL.has(code);
}
