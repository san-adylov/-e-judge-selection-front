import { type FormBuilder, type FormControl, type FormGroup, Validators } from '@angular/forms';

import type { Schemas } from '@domain/api/api.types';

export type JudgeApplication = Schemas['JudgeApplicationResponse'];
export type JudgeApplicationStatus = NonNullable<JudgeApplication['status']>;
export type JudgeDraftRequest = Schemas['JudgeApplicationDraftRequest'];
export type PreferredLanguage = NonNullable<JudgeDraftRequest['preferredLanguage']>;
export type ContestCard = Schemas['ContestCardResponse'];
export type Contest = Schemas['ContestResponse'];
export type JudgeScores = Schemas['JudgeScoresResponse'];

/** Базовый адрес раздела (маршруты подключает оркестратор). */
export const JUDGE_APPLICATIONS_URL = '/cabinet/judge-applications';

/** Языки прохождения этапов, которые предлагаем судье (`Language` бэкенда допускает ещё EN). */
export const PREFERRED_LANGUAGES: readonly PreferredLanguage[] = ['RU', 'KG'];

/** Ограничения `JudgeApplicationDraftRequest` (`@Size`). */
export const DRAFT_LIMITS = { email: 255, phone: 32, text: 1000 } as const;

export interface JudgeApplicationFormValue {
  contestId: number | null;
  preferredLanguage: PreferredLanguage;
  email: string;
  homePhone: string;
  workPhone: string;
  homeAddress: string;
  contactInfo: string;
}

export type JudgeApplicationForm = FormGroup<{
  [K in keyof JudgeApplicationFormValue]: FormControl<JudgeApplicationFormValue[K]>;
}>;

export interface JudgeApplicationActions {
  /** Черновик можно менять повторным `POST /judge-applications` (upsert по конкурсу). */
  edit: boolean;
  /** `POST /{id}/submit`: переход DRAFT → PENDING_SECRETARY_REVIEW. */
  submit: boolean;
  /** Баллы показываем с регистрации: до неё оценивать нечего. */
  scores: boolean;
}

const BEFORE_REGISTRATION: readonly JudgeApplicationStatus[] = ['DRAFT', 'PENDING_SECRETARY_REVIEW'];

/** Действия судьи по статусу заявки — по `JudgeApplicationStateMachine` и `JudgeApplication.updateDraft`. */
export function judgeApplicationActions(status: JudgeApplicationStatus | null | undefined): JudgeApplicationActions {
  const draft = status === 'DRAFT';

  return {
    edit: draft,
    submit: draft,
    scores: !!status && !BEFORE_REGISTRATION.includes(status),
  };
}

export const FINAL_STATUSES: readonly JudgeApplicationStatus[] = [
  'REJECTED_AFTER_DOCUMENT_REVIEW',
  'REJECTED_ASSESSMENT_APPROVAL',
  'REJECTED_AFTER_INTERVIEW',
  'APPROVED_AFTER_INTERVIEW',
];

/** Итоговый статус (`JudgeApplicationStatus.isFinal()` бэкенда). */
export function isFinalStatus(status: JudgeApplicationStatus | null | undefined): boolean {
  return !!status && FINAL_STATUSES.includes(status);
}

/** Цвет подсказки к статусу: итог «одобрено» — успех, любой отказ — ошибка, остальное — информация. */
export function statusHintSeverity(status: JudgeApplicationStatus | null | undefined): 'success' | 'error' | 'info' {
  if (status === 'APPROVED_AFTER_INTERVIEW') return 'success';
  if (status?.startsWith('REJECTED_')) return 'error';

  return 'info';
}

export const STAGES = ['submission', 'secretary', 'documents', 'assessment', 'interview'] as const;
export type StageKey = (typeof STAGES)[number];
export type StageState = 'done' | 'current' | 'rejected' | 'upcoming';

export interface Stage {
  key: StageKey;
  state: StageState;
}

/** Статус → этап цепочки §17.2 и его исход. */
const STATUS_STAGE: Record<JudgeApplicationStatus, [StageKey, Exclude<StageState, 'upcoming'>]> = {
  DRAFT: ['submission', 'current'],
  PENDING_SECRETARY_REVIEW: ['secretary', 'current'],
  REGISTERED: ['secretary', 'done'],
  PENDING_DOCUMENT_REVIEW: ['documents', 'current'],
  APPROVED_AFTER_DOCUMENT_REVIEW: ['documents', 'done'],
  REJECTED_AFTER_DOCUMENT_REVIEW: ['documents', 'rejected'],
  PENDING_ASSESSMENT_APPROVAL: ['assessment', 'current'],
  APPROVED_ASSESSMENT_APPROVAL: ['assessment', 'done'],
  REJECTED_ASSESSMENT_APPROVAL: ['assessment', 'rejected'],
  PENDING_INTERVIEW: ['interview', 'current'],
  APPROVED_AFTER_INTERVIEW: ['interview', 'done'],
  REJECTED_AFTER_INTERVIEW: ['interview', 'rejected'],
};

/** Ход рассмотрения: этапы до текущего пройдены, после — впереди. */
export function judgeApplicationStages(status: JudgeApplicationStatus | null | undefined): Stage[] {
  const [currentKey, outcome] = STATUS_STAGE[status ?? 'DRAFT'];
  const currentIndex = STAGES.indexOf(currentKey);

  return STAGES.map((key, index): Stage => ({
    key,
    state: index < currentIndex ? 'done' : index === currentIndex ? outcome : 'upcoming',
  }));
}

/**
 * Конкурсы для новой заявки: открыт приём документов (`PUBLISHED`) и заявки судьи на него ещё нет.
 * Бэкенд держит одну заявку на пару (конкурс, судья): повторный `POST` обновил бы существующую.
 */
export function availableContests(
  contests: readonly ContestCard[],
  applications: readonly JudgeApplication[],
): ContestCard[] {
  const taken = new Set(applications.map((application) => application.contestId));

  return contests.filter((contest) => contest.status === 'PUBLISHED' && !taken.has(contest.id));
}

export function createJudgeApplicationForm(fb: FormBuilder, language: PreferredLanguage = 'RU'): JudgeApplicationForm {
  const nb = fb.nonNullable;

  return nb.group({
    contestId: fb.control<number | null>(null, Validators.required),
    preferredLanguage: nb.control<PreferredLanguage>(language, Validators.required),
    email: nb.control('', [Validators.email, Validators.maxLength(DRAFT_LIMITS.email)]),
    homePhone: nb.control('', Validators.maxLength(DRAFT_LIMITS.phone)),
    workPhone: nb.control('', Validators.maxLength(DRAFT_LIMITS.phone)),
    homeAddress: nb.control('', Validators.maxLength(DRAFT_LIMITS.text)),
    contactInfo: nb.control('', Validators.maxLength(DRAFT_LIMITS.text)),
  });
}

/** Заявка → значение формы черновика. */
export function toFormValue(application: JudgeApplication): JudgeApplicationFormValue {
  return {
    contestId: application.contestId ?? null,
    preferredLanguage: application.preferredLanguage ?? 'RU',
    email: application.email ?? '',
    homePhone: application.homePhone ?? '',
    workPhone: application.workPhone ?? '',
    homeAddress: application.homeAddress ?? '',
    contactInfo: application.contactInfo ?? '',
  };
}

/** Форма → `JudgeApplicationDraftRequest`: строки обрезаются, пустые не отправляются. */
export function toDraftRequest(value: JudgeApplicationFormValue): JudgeDraftRequest {
  if (value.contestId === null) throw new Error('contestId is required');

  const text = (raw: string): string | undefined => raw.trim() || undefined;

  return {
    contestId: value.contestId,
    preferredLanguage: value.preferredLanguage,
    email: text(value.email),
    homePhone: text(value.homePhone),
    workPhone: text(value.workPhone),
    homeAddress: text(value.homeAddress),
    contactInfo: text(value.contactInfo),
  };
}

export interface ScoreTile {
  key: 'documents' | 'professional' | 'essay';
  value: number | null;
}

/** Бэкенд отдаёт `documentRawScore` примитивом (0, пока оценок нет); эссе у трека судьи обычно пустое. */
export function scoreTiles(scores: JudgeScores | null): ScoreTile[] {
  if (!scores) return [];

  const tiles: ScoreTile[] = [
    { key: 'documents', value: scores.documentRawScore ?? null },
    { key: 'professional', value: scores.professionalScore ?? null },
  ];

  if (scores.essayScore !== undefined && scores.essayScore !== null) {
    tiles.push({ key: 'essay', value: scores.essayScore });
  }

  return tiles;
}
