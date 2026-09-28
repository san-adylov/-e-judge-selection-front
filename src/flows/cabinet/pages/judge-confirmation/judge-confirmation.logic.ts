import type { FileCategory, Schemas } from '@domain/api/api.types';
import type { DirectoryOption } from '@domain/stores/directory.store';
import { parseLocalDate, toLocalDate } from '@shared/lib/dates';

export type Confirmation = Schemas['JudgeConfirmationResponse'];
export type ConfirmationRequest = Schemas['JudgeConfirmationRequest'];
export type ConfirmationStatus = NonNullable<Confirmation['status']>;

/**
 * Что показать по последней заявке (`GET /active-judge-confirmations/my/latest`, `null` — заявок не было, 404):
 * `intro` — пояснение и пустая форма, `draft` — черновик CREATED (редактирование и отправка),
 * `pending` — у секретаря (только чтение), `approved` / `rejected` — решение принято.
 */
export type ConfirmationView = 'intro' | 'draft' | 'pending' | 'approved' | 'rejected';

export function confirmationView(latest: Confirmation | null | undefined): ConfirmationView {
  switch (latest?.status) {
    case 'CREATED':
      return 'draft';
    case 'PENDING_SECRETARY_REVIEW':
    case 'UNDER_REVIEW':
      return 'pending';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'intro';
  }
}

export interface ConfirmationActions {
  /** Форма открыта сразу: заявок ещё не было или есть черновик CREATED. */
  edit: boolean;
  /**
   * Можно начать новую заявку: последняя завершена (APPROVED / REJECTED). Бэкенд ищет незавершённую заявку
   * (`findOpen` без финальных статусов) и создаёт новую; повторное подтверждение судье тоже разрешено (спека 17.1).
   */
  startNew: boolean;
}

/** Действия по статусу — по `JudgeConfirmationStateMachine` и `JudgeConfirmationService.saveDraft`. */
export function confirmationActions(view: ConfirmationView): ConfirmationActions {
  return {
    edit: view === 'intro' || view === 'draft',
    startNew: view === 'approved' || view === 'rejected',
  };
}

/** Значение формы: даты — `Date` для `p-datepicker`, файлы — id из `<app-file-upload>`. */
export interface ConfirmationFormValue {
  courtId: number | null;
  workExperienceFrom: Date | null;
  workExperienceTo: Date | null;
  decreeFileId: number | null;
  assignmentFileId: number | null;
  qualificationFileId: number | null;
}

/** Три обязательных документа (`hasRequiredFiles`): поле формы, категория файла, подпись. */
export const FILE_FIELDS = [
  { key: 'decreeFileId', category: 'JUDGE_DECREE', label: 'judge-confirmation.form.decree' },
  { key: 'assignmentFileId', category: 'JUDGE_ASSIGNMENT', label: 'judge-confirmation.form.assignment' },
  { key: 'qualificationFileId', category: 'JUDGE_QUALIFICATION', label: 'judge-confirmation.form.qualification' },
] as const satisfies readonly { key: keyof ConfirmationFormValue; category: FileCategory; label: string }[];

/** Заявка → форма. Для новой заявки после решения поля берутся из прежней (их можно заменить). */
export function toFormValue(source: Confirmation | null | undefined): ConfirmationFormValue {
  return {
    courtId: source?.courtId ?? null,
    workExperienceFrom: parseLocalDate(source?.workExperienceFrom),
    workExperienceTo: parseLocalDate(source?.workExperienceTo),
    decreeFileId: source?.decreeFileId ?? null,
    assignmentFileId: source?.assignmentFileId ?? null,
    qualificationFileId: source?.qualificationFileId ?? null,
  };
}

/**
 * Форма → `JudgeConfirmationRequest`. `courtName` — подпись выбранного суда (как в v1),
 * бэкенд хранит её рядом с `courtId` (до 500 символов).
 */
export function toRequest(value: ConfirmationFormValue, courtName: string | null | undefined): ConfirmationRequest {
  const request: ConfirmationRequest = {};

  if (value.courtId !== null) {
    request.courtId = value.courtId;
    if (courtName) request.courtName = courtName.slice(0, 500);
  }

  if (value.workExperienceFrom) request.workExperienceFrom = toLocalDate(value.workExperienceFrom);
  if (value.workExperienceTo) request.workExperienceTo = toLocalDate(value.workExperienceTo);
  if (value.decreeFileId !== null) request.decreeFileId = value.decreeFileId;
  if (value.assignmentFileId !== null) request.assignmentFileId = value.assignmentFileId;
  if (value.qualificationFileId !== null) request.qualificationFileId = value.qualificationFileId;

  return request;
}

/**
 * Суды для `p-select` (справочник `COURT_NAME`, в v1 — `/court-names/all`). Если суд из сохранённой заявки
 * в справочнике уже неактивен, он добавляется по сохранённому названию, чтобы значение не пропало.
 */
export function courtOptions(options: DirectoryOption[], source: Confirmation | null | undefined): DirectoryOption[] {
  const savedId = source?.courtId;

  if (savedId === undefined || !source?.courtName || options.some((option) => option.value === savedId)) {
    return options;
  }

  return [...options, { label: source.courtName, value: savedId }];
}

/** Подпись суда для `courtName`: из справочника, иначе из сохранённой заявки. */
export function courtNameOf(
  courtId: number | null,
  options: DirectoryOption[],
  source: Confirmation | null | undefined,
): string | null {
  if (courtId === null) return null;

  const label = options.find((option) => option.value === courtId)?.label;

  return label ?? (source?.courtId === courtId ? (source.courtName ?? null) : null);
}

/** Начало стажа позже окончания. */
export function isRangeInvalid(from: Date | null, to: Date | null): boolean {
  return from !== null && to !== null && from.getTime() > to.getTime();
}

/**
 * Готовность к отправке: бэкенд проверяет только три файла (4137), суд и стаж обязательны по правилу v1.
 * Возвращает незаполненные поля формы.
 */
export function missingForSubmit(value: ConfirmationFormValue): (keyof ConfirmationFormValue)[] {
  return (Object.keys(value) as (keyof ConfirmationFormValue)[]).filter((key) => value[key] === null);
}
