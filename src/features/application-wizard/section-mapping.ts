import type { Schemas } from '@domain/api/api.types';
import { parseLocalDate, toLocalDate } from '@shared/lib/dates';

import type { SectionConfig, SectionField } from './section-config';

export type RecordValue = Record<string, unknown> & { id?: number };

type RecordSource = NonNullable<Schemas['EducationResponse']['source']>;

export function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/** Запись раздела → значения формы: даты — `Date` (p-datepicker), флажки — `boolean`, пустое — `null`. */
export function recordToFormValue(fields: readonly SectionField[], record?: RecordValue): Record<string, unknown> {
  const value: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = record?.[field.key];

    if (field.type === 'date') value[field.key] = parseLocalDate(typeof raw === 'string' ? raw : null);
    else if (field.type === 'checkbox') value[field.key] = raw === true;
    else value[field.key] = raw ?? null;
  }

  return value;
}

/**
 * Значения формы → тело `*Request`: только поля конфигурации, строки обрезаются, пустые значения не отправляются,
 * даты — `yyyy-MM-dd`, флажки — всегда `boolean` (`EmploymentRequest.current` — примитив).
 */
export function formValueToBody(
  fields: readonly SectionField[],
  value: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = value[field.key];

    if (field.type === 'checkbox') {
      body[field.key] = raw === true;
      continue;
    }

    if (isEmptyValue(raw)) continue;

    if (raw instanceof Date) body[field.key] = toLocalDate(raw);
    else body[field.key] = typeof raw === 'string' ? raw.trim() : raw;
  }

  return body;
}

/** Окончание раньше начала (`EmploymentRequest.isPeriodValid`; для остальных разделов — та же логика). */
export function dateRangeInvalid(config: SectionConfig, value: Record<string, unknown>): boolean {
  if (!config.dateRange) return false;

  const [startKey, endKey] = config.dateRange;
  const start = value[startKey];
  const end = value[endKey];

  // «По настоящее время»: бэкенд дату окончания не проверяет.
  if (value['current'] === true) return false;

  return start instanceof Date && end instanceof Date && end.getTime() < start.getTime();
}

/** Метка источника записи: импорт из реестра дипломов или кадастра; ручные записи без метки. */
export function sourceLabelKey(record: RecordValue): string | null {
  const source = record['source'] as RecordSource | undefined;

  return source && source !== 'MANUAL' ? `profile.source.${source}` : null;
}

export function fileIdOf(record: RecordValue): number | null {
  const fileId = record['fileId'];

  return typeof fileId === 'number' ? fileId : null;
}

/** Параметры сообщения об импорте: найдено / добавлено / пропущено как дубликаты. */
export function importResultParams(result: Schemas['ImportResultResponse']): Record<string, number> {
  return {
    found: result.found ?? 0,
    imported: result.imported ?? 0,
    skipped: result.skippedAsDuplicates ?? 0,
  };
}
