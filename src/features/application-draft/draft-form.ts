import { type FormBuilder, type FormControl, type FormGroup, Validators } from '@angular/forms';

import type { ApplicationStatus, Schemas } from '@domain/api/api.types';

type DraftRequest = Schemas['ApplicationDraftRequest'];
type Application = Schemas['ApplicationResponse'];

export type PreferredLanguage = NonNullable<DraftRequest['preferredLanguage']>;

/** Языки взаимодействия, которые предлагаем кандидату (словаря EN нет). */
export const DRAFT_LANGUAGES: readonly PreferredLanguage[] = ['RU', 'KG'];

/** Статусы, в которых кандидат работает с заявкой в мастере (правила §8.1–8.2 спеки). */
const WIZARD_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['NEW', 'RETURNED_FOR_CORRECTION']);

export interface DraftFormValue {
  preferredLanguage: PreferredLanguage | null;
  email: string;
  homePhone: string;
  workPhone: string;
  homeAddress: string;
  contactInfo: string;
}

export type DraftForm = FormGroup<{ [K in keyof DraftFormValue]: FormControl<DraftFormValue[K]> }>;

/** Мастер открыт для черновика и для заявки, возвращённой на доработку. */
export function isWizardStatus(status: ApplicationStatus | undefined): boolean {
  return status !== undefined && WIZARD_STATUSES.has(status);
}

/**
 * Контакты заявки меняются только в черновике (`ContestApplication.isDraft()`); после возврата на доработку
 * бэкенд отвечает 4013 — кандидат правит личное дело и отправляет заявку повторно.
 */
export function contactsEditable(status: ApplicationStatus | undefined): boolean {
  return status === 'NEW';
}

/**
 * Нужен ли `PATCH /contest-application/{id}` перед переходом или отправкой: только черновик с изменёнными контактами.
 * Для RETURNED_FOR_CORRECTION — никогда: повторная отправка идёт одним `send-for-review`.
 */
export function needsDraftUpdate(status: ApplicationStatus | undefined, dirty: boolean): boolean {
  return contactsEditable(status) && dirty;
}

/** Ограничения — как в `ApplicationDraftRequest.java` (`@Email @Size`). */
export function createDraftForm(fb: FormBuilder): DraftForm {
  const nn = fb.nonNullable;

  return nn.group({
    preferredLanguage: nn.control<PreferredLanguage | null>(null),
    email: nn.control('', [Validators.email, Validators.maxLength(255)]),
    homePhone: nn.control('', Validators.maxLength(32)),
    workPhone: nn.control('', Validators.maxLength(32)),
    homeAddress: nn.control('', Validators.maxLength(1000)),
    contactInfo: nn.control('', Validators.maxLength(1000)),
  });
}

/** Ответ бэкенда → значение формы; отсутствующие поля — пустые строки. */
export function draftFormValue(application: Application | null | undefined): DraftFormValue {
  return {
    preferredLanguage: application?.preferredLanguage ?? null,
    email: application?.email ?? '',
    homePhone: application?.homePhone ?? '',
    workPhone: application?.workPhone ?? '',
    homeAddress: application?.homeAddress ?? '',
    contactInfo: application?.contactInfo ?? '',
  };
}

/**
 * Значение формы → тело `PATCH /contest-application/{id}`. Бэкенд перезаписывает все контакты разом,
 * поэтому отправляем полное тело; пустые строки — как отсутствие значения (без ключа).
 */
export function toDraftRequest(value: Partial<DraftFormValue>): DraftRequest {
  const body: DraftRequest = {};
  const text = (raw: string | undefined): string | undefined => raw?.trim() || undefined;

  if (value.preferredLanguage) body.preferredLanguage = value.preferredLanguage;

  const fields = {
    email: text(value.email),
    homePhone: text(value.homePhone),
    workPhone: text(value.workPhone),
    homeAddress: text(value.homeAddress),
    contactInfo: text(value.contactInfo),
  };

  for (const [key, field] of Object.entries(fields) as [keyof typeof fields, string | undefined][]) {
    if (field !== undefined) body[key] = field;
  }

  return body;
}
