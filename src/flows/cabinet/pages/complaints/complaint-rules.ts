import type { AbstractControl, ValidationErrors } from '@angular/forms';

import type { ApplicationStatus, ContestStatus, Schemas as S } from '@domain/api/api.types';
import { parseLocalDate, toLocalDate } from '@shared/lib/dates';

export type Complaint = S['ComplaintResponse'];
export type ComplaintType = S['SubmitComplaintRequest']['type'];
export type Application = S['ApplicationResponse'];
export type StatusHistory = S['ApplicationStatusHistoryResponse'];

export const COMPLAINT_TYPES: readonly ComplaintType[] = ['DOCUMENT_STAGE', 'TEST_RESULT', 'CONTEST_VIOLATION'];

/** `SubmitComplaintRequest.text`: `@NotBlank @Size(max = 8000)`. */
export const COMPLAINT_TEXT_MAX = 8000;

/**
 * Срок жалобы на этап документов — календарные дни после отклонения Советом
 * (`tandoo.complaint.document-stage-deadline-days`, по умолчанию 3; в API не отдаётся).
 */
export const DOCUMENT_STAGE_DEADLINE_DAYS = 3;

/** Статусы заявки, при которых допускается жалоба на результат теста (`ComplaintAdmissibility.requireTestResult`). */
const TEST_RESULT_STATUSES: readonly ApplicationStatus[] = ['TEST_FAILED', 'REJECTED_AFTER_TEST'];

const BISHKEK_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bishkek',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Календарный день `yyyy-MM-dd` по Бишкеку: часы бэкенда закреплены за Asia/Bishkek. */
export function bishkekDay(date: Date): string {
  const parts = Object.fromEntries(BISHKEK_DAY.formatToParts(date).map((part) => [part.type, part.value]));

  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}

/** Момент последнего перехода заявки в «Отклонена Советом» (`lastTransitionTo`). */
export function lastRejectionByBoard(history: readonly StatusHistory[]): string | null {
  const times = history
    .filter((item) => item.to === 'REJECTED_BY_BOARD' && item.changedAt)
    .map((item) => item.changedAt!)
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  return times.at(-1) ?? null;
}

/**
 * Последний день подачи жалобы на этап документов (`yyyy-MM-dd`): день отклонения + 3 дня включительно.
 * Без записи в истории бэкенд считает днём отклонения сегодняшний.
 */
export function documentStageDeadline(rejectedAt: string | null | undefined, now: Date): string {
  const rejected = rejectedAt ? new Date(rejectedAt) : now;
  const day = parseLocalDate(bishkekDay(Number.isNaN(rejected.getTime()) ? now : rejected))!;

  day.setDate(day.getDate() + DOCUMENT_STAGE_DEADLINE_DAYS);

  return toLocalDate(day);
}

export interface EligibilityContext {
  application: Application;
  /** Статус конкурса заявки; `null` — не удалось загрузить. */
  contestStatus: ContestStatus | null | undefined;
  /** История статусов заявки (нужна только для «Отклонена Советом»). */
  history: readonly StatusHistory[];
  /** Жалобы кандидата: по одной заявке — не более одной жалобы каждого типа. */
  complaints: readonly Complaint[];
  now: Date;
}

/** Правило подачи по типу (`ComplaintAdmissibility.require`), без проверки «одна жалоба каждого типа». */
export function isTypeAdmissible(type: ComplaintType, ctx: EligibilityContext): boolean {
  switch (type) {
    case 'DOCUMENT_STAGE':
      return (
        ctx.application.status === 'REJECTED_BY_BOARD' &&
        bishkekDay(ctx.now) <= documentStageDeadline(lastRejectionByBoard(ctx.history), ctx.now)
      );
    case 'TEST_RESULT':
      return TEST_RESULT_STATUSES.includes(ctx.application.status as ApplicationStatus);
    case 'CONTEST_VIOLATION':
      return ctx.contestStatus === 'COMPLETED';
  }
}

/** Типы жалоб, которые можно подать по заявке сейчас. */
export function eligibleComplaintTypes(ctx: EligibilityContext): ComplaintType[] {
  const filed = new Set(
    ctx.complaints.filter((item) => item.applicationId === ctx.application.id).map((item) => item.type),
  );

  return COMPLAINT_TYPES.filter((type) => !filed.has(type) && isTypeAdmissible(type, ctx));
}

/** Нужна ли история статусов, чтобы проверить срок жалобы на этап документов. */
export function needsHistory(application: Application): boolean {
  return application.status === 'REJECTED_BY_BOARD';
}

export interface ComplaintFormValue {
  applicationId: number | null;
  type: ComplaintType | null;
  text: string;
}

/** Форма → `SubmitComplaintRequest`; текст обрезается так же, как на бэкенде (`text.trim()`). */
export function toSubmitRequest(value: ComplaintFormValue): S['SubmitComplaintRequest'] | null {
  const text = value.text.trim();

  if (value.applicationId === null || value.type === null || !text || text.length > COMPLAINT_TEXT_MAX) return null;

  return { applicationId: value.applicationId, type: value.type, text };
}

/** `@NotBlank`: текст из одних пробелов считается пустым. */
export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && !control.value.trim() ? { required: true } : null;
}

/** Предвыбор из ссылки `/cabinet/complaints?applicationId=…&type=…`. */
export interface ComplaintPreset {
  applicationId: number | null;
  type: ComplaintType | null;
}

/** Query-параметры → предвыбор; без корректного `applicationId` форма сама не открывается. */
export function presetFromQuery(applicationId?: string, type?: string): ComplaintPreset | null {
  const id = parseId(applicationId);

  return id === null ? null : { applicationId: id, type: parseComplaintType(type) };
}

/** Число из query-параметра (`?applicationId=12`); иное — `null`. */
export function parseId(value: string | null | undefined): number | null {
  const id = Number(value);

  return value && Number.isInteger(id) && id > 0 ? id : null;
}

/** Тип жалобы из query-параметра (`?type=TEST_RESULT`). */
export function parseComplaintType(value: string | null | undefined): ComplaintType | null {
  return COMPLAINT_TYPES.find((type) => type === value) ?? null;
}

/** Подпись заявки: «Конкурс · № рег. номера». */
export function applicationLabel(application: Application | undefined, fallbackId?: number): string {
  if (!application) return fallbackId === undefined ? '' : `#${fallbackId}`;

  const name = application.contestName ?? `#${application.contestId ?? application.id}`;

  return application.registrationNumber ? `${name} · № ${application.registrationNumber}` : name;
}
