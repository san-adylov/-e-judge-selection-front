import {
  type AbstractControl,
  type FormBuilder,
  type FormControl,
  type FormGroup,
  type ValidationErrors,
  type ValidatorFn,
  Validators,
} from '@angular/forms';

import type { ContestType, Schemas, StageKind } from '@domain/api/api.types';
import { parseLocalDate, parseServerDateTime, toLocalDate, toServerDateTime } from '@shared/lib/dates';

import type { Contest } from './contest-rules';

type DetailsRequest = Schemas['ContestDetailsRequest'];
type StepRequest = Schemas['ContestStepRequest'];
type StepResponse = Schemas['ContestStepResponse'];
type StepType = StepRequest['type'];

export const NAME_MAX = 500;
export const TEXT_MAX = 4000;

export const CONTEST_TYPES: readonly ContestType[] = ['RESERVE', 'SUPREME_COURT', 'CONSTITUTIONAL_COURT'];
export const STEP_TYPES: readonly StepType[] = [
  'OPENING',
  'DOCUMENT_ASSESSMENT',
  'TESTING',
  'ESSAY',
  'INTERVIEW',
  'CLOSING',
];
export const STAGES: readonly StageKind[] = ['TESTING', 'ESSAY', 'INTERVIEW'];

/** Поля формы: `Date` для календарей PrimeNG, id — для селектов справочников. */
export interface ContestFormValue {
  name: string;
  description: string;
  note: string;
  additionalInfo: string;
  type: ContestType | null;
  courtInstanceId: number | null;
  vacantPlaces: number | null;
  ageRequirementId: number | null;
  educationRequirementId: number | null;
  workExperienceRequirementId: number | null;
  citizenshipId: number | null;
  languageLevelId: number | null;
  startDate: Date | null;
  documentAcceptanceEndDate: Date | null;
  testingStart: Date | null;
  testingEnd: Date | null;
  essayStart: Date | null;
  essayEnd: Date | null;
  interviewStart: Date | null;
  interviewEnd: Date | null;
  announcementFileId: number | null;
  requiredDocumentTypeIds: number[];
}

export type ContestForm = FormGroup<{ [K in keyof ContestFormValue]: FormControl<ContestFormValue[K]> }>;

/** Шаг календарного плана в форме: все шесть типов по порядку, даты необязательны. */
export interface StepDraft {
  type: StepType;
  start: Date | null;
  end: Date | null;
}

/** Квота вопросов категории в тесте конкурса; `null` — категория не входит в тест. */
export interface QuotaDraft {
  categoryId: number;
  questionCount: number | null;
}

/** Окно этапа задаётся целиком: `StageWindowRequest` требует и начало, и конец. */
function windowPair(startKey: keyof ContestFormValue, endKey: keyof ContestFormValue): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start: unknown = group.get(startKey)?.value;
    const end: unknown = group.get(endKey)?.value;

    if (!start && !end) return null;
    if (!start || !end) return { windowIncomplete: startKey };
    if (start instanceof Date && end instanceof Date && end < start) return { windowRange: startKey };

    return null;
  };
}

/** Окончание приёма документов — строго после начала (`ContestEditorService.validateDates`). */
const acceptanceRange: ValidatorFn = (group) => {
  const start: unknown = group.get('startDate')?.value;
  const end: unknown = group.get('documentAcceptanceEndDate')?.value;

  if (!(start instanceof Date) || !(end instanceof Date)) return null;

  return toLocalDate(end) > toLocalDate(start) ? null : { acceptanceRange: true };
};

export function createContestForm(builder: FormBuilder): ContestForm {
  const fb = builder.nonNullable;
  const text = (max: number, ...validators: ValidatorFn[]) =>
    fb.control('', [Validators.maxLength(max), ...validators]);
  const id = () => fb.control<number | null>(null);
  const date = () => fb.control<Date | null>(null);

  return fb.group(
    {
      name: text(NAME_MAX, Validators.required),
      description: text(TEXT_MAX),
      note: text(TEXT_MAX),
      additionalInfo: text(TEXT_MAX),
      type: fb.control<ContestType | null>(null),
      courtInstanceId: id(),
      vacantPlaces: fb.control<number | null>(null, Validators.min(1)),
      ageRequirementId: id(),
      educationRequirementId: id(),
      workExperienceRequirementId: id(),
      citizenshipId: id(),
      languageLevelId: id(),
      startDate: date(),
      documentAcceptanceEndDate: date(),
      testingStart: date(),
      testingEnd: date(),
      essayStart: date(),
      essayEnd: date(),
      interviewStart: date(),
      interviewEnd: date(),
      announcementFileId: id(),
      requiredDocumentTypeIds: fb.control<number[]>([]),
    },
    {
      validators: [
        acceptanceRange,
        windowPair('testingStart', 'testingEnd'),
        windowPair('essayStart', 'essayEnd'),
        windowPair('interviewStart', 'interviewEnd'),
      ],
    },
  );
}

export function contestToForm(contest: Contest): ContestFormValue {
  return {
    name: contest.name ?? '',
    description: contest.description ?? '',
    note: contest.note ?? '',
    additionalInfo: contest.additionalInfo ?? '',
    type: contest.type ?? null,
    courtInstanceId: contest.courtInstanceId ?? null,
    vacantPlaces: contest.vacantPlaces ?? null,
    ageRequirementId: contest.ageRequirementId ?? null,
    educationRequirementId: contest.educationRequirementId ?? null,
    workExperienceRequirementId: contest.workExperienceRequirementId ?? null,
    citizenshipId: contest.citizenshipId ?? null,
    languageLevelId: contest.languageLevelId ?? null,
    startDate: parseLocalDate(contest.startDate),
    documentAcceptanceEndDate: parseLocalDate(contest.documentAcceptanceEndDate),
    testingStart: parseServerDateTime(contest.testingWindow?.start),
    testingEnd: parseServerDateTime(contest.testingWindow?.end),
    essayStart: parseServerDateTime(contest.essayWindow?.start),
    essayEnd: parseServerDateTime(contest.essayWindow?.end),
    interviewStart: parseServerDateTime(contest.interviewWindow?.start),
    interviewEnd: parseServerDateTime(contest.interviewWindow?.end),
    announcementFileId: contest.announcementFileId ?? null,
    requiredDocumentTypeIds: [...(contest.requiredDocumentTypeIds ?? [])],
  };
}

function window(start: Date | null, end: Date | null): DetailsRequest['testingWindow'] {
  return start && end ? { start: toServerDateTime(start), end: toServerDateTime(end) } : undefined;
}

/**
 * `PATCH /contest/{id}` заменяет все детали разом (`Contest.updateDetails`), поэтому в тело идут все поля,
 * а не только изменённые. Пустые строки и `null` не отправляются — бэкенд хранит `null`.
 */
export function toDetailsRequest(
  value: ContestFormValue,
  courtInstanceName: string | null,
  quotas: readonly QuotaDraft[],
): DetailsRequest {
  const text = (item: string) => item.trim() || undefined;
  const id = (item: number | null) => item ?? undefined;

  return {
    description: text(value.description),
    note: text(value.note),
    additionalInfo: text(value.additionalInfo),
    type: value.type ?? undefined,
    courtInstanceId: id(value.courtInstanceId),
    courtInstanceName: value.courtInstanceId === null ? undefined : (courtInstanceName ?? undefined),
    vacantPlaces: id(value.vacantPlaces),
    ageRequirementId: id(value.ageRequirementId),
    educationRequirementId: id(value.educationRequirementId),
    workExperienceRequirementId: id(value.workExperienceRequirementId),
    citizenshipId: id(value.citizenshipId),
    languageLevelId: id(value.languageLevelId),
    startDate: value.startDate ? toLocalDate(value.startDate) : undefined,
    documentAcceptanceEndDate: value.documentAcceptanceEndDate
      ? toLocalDate(value.documentAcceptanceEndDate)
      : undefined,
    testingWindow: window(value.testingStart, value.testingEnd),
    essayWindow: window(value.essayStart, value.essayEnd),
    interviewWindow: window(value.interviewStart, value.interviewEnd),
    announcementFileId: id(value.announcementFileId),
    requiredDocumentTypeIds: [...new Set(value.requiredDocumentTypeIds)],
    questionCategories: quotas
      .filter((quota) => quota.questionCount !== null && quota.questionCount > 0)
      .map((quota) => ({ categoryId: quota.categoryId, questionCount: quota.questionCount ?? undefined })),
  };
}

/** Шесть шагов по порядку (`ContestStepType`); даты — из плана, если шаг уже есть. */
export function stepsFromPlan(plan: readonly StepResponse[] | undefined): StepDraft[] {
  return STEP_TYPES.map((type) => {
    const step = plan?.find((item) => item.type === type);

    return { type, start: parseServerDateTime(step?.start), end: parseServerDateTime(step?.end) };
  });
}

/**
 * `PUT /contest/steps/{id}` заменяет план целиком: порядок — по `STEP_TYPES`, шаги без дат не отправляются.
 * Шаг с одной датой допустим (`start`/`end` у `ContestStepRequest` необязательны).
 */
export function toStepRequests(steps: readonly StepDraft[]): StepRequest[] {
  return steps
    .filter((step) => step.start || step.end)
    .map((step) => ({
      type: step.type,
      start: step.start ? toServerDateTime(step.start) : undefined,
      end: step.end ? toServerDateTime(step.end) : undefined,
    }));
}

/** Шаг с датой окончания раньше начала. */
export function invalidSteps(steps: readonly StepDraft[]): StepType[] {
  return steps.filter((step) => step.start && step.end && step.end < step.start).map((step) => step.type);
}

/** Квоты по всем активным категориям; у категорий конкурса — его количество, у остальных — `null`. */
export function quotasFromContest(
  contest: Contest,
  categories: readonly Schemas['QuestionCategoryResponse'][],
): QuotaDraft[] {
  const current = new Map((contest.questionCategories ?? []).map((item) => [item.categoryId, item.questionCount]));

  return categories
    .filter((category) => category.id !== undefined && (category.active !== false || current.has(category.id)))
    .map((category) => ({ categoryId: category.id as number, questionCount: current.get(category.id) ?? null }));
}

/** План изменился — `PUT /contest/steps` нужен, иначе лишний запрос и лишняя запись аудита. */
export function stepsChanged(before: readonly StepDraft[], after: readonly StepDraft[]): boolean {
  return JSON.stringify(toStepRequests(before)) !== JSON.stringify(toStepRequests(after));
}
