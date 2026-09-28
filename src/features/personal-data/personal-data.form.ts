import {
  type AbstractControl,
  type FormBuilder,
  type FormControl,
  type FormGroup,
  type ValidationErrors,
  type ValidatorFn,
  Validators,
} from '@angular/forms';

import type { Gender, MaritalStatus, PersonalDataFormValue, PreferredLanguage } from './personal-data.mapping';

export type PersonalDataForm = FormGroup<{
  [K in keyof PersonalDataFormValue]: FormControl<PersonalDataFormValue[K]>;
}>;

/** Телефон: цифры, пробелы, скобки, дефис, необязательный «+» в начале; до 32 символов (`@Size(max = 32)`). */
export const PHONE_PATTERN = /^\+?[\d\s()-]{5,31}$/;

/** Не только пробелы: `@NotBlank` бэкенда (ошибка та же, что у пустого поля). */
const notBlank: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.length > 0 && !control.value.trim() ? { required: true } : null;

/** Дата строго в прошлом: `@Past` бэкенда. */
export const pastDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;

  if (!(value instanceof Date)) return null;

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return value < today ? null : { pastDate: true };
};

/** Форма `ProfileRequest`: ограничения повторяют аннотации `ProfileRequest.java`. */
export function createPersonalDataForm(builder: FormBuilder): PersonalDataForm {
  const fb = builder.nonNullable;
  const text = (max: number, ...validators: ValidatorFn[]) =>
    fb.control('', [Validators.maxLength(max), ...validators]);
  const id = () => fb.control<number | null>(null);

  return fb.group({
    lastName: text(100, Validators.required, notBlank),
    firstName: text(100, Validators.required, notBlank),
    middleName: text(100),
    birthDate: fb.control<Date | null>(null, [Validators.required, pastDateValidator]),
    gender: fb.control<Gender | null>(null, Validators.required),
    citizenshipId: id(),
    nationalityId: id(),
    maritalStatus: fb.control<MaritalStatus | null>(null),
    birthPlace: text(500),
    phoneNumber: text(32, Validators.pattern(PHONE_PATTERN)),
    additionalPhoneNumber: text(32, Validators.pattern(PHONE_PATTERN)),
    email: text(255, Validators.email),
    additionalEmail: text(255, Validators.email),
    regionId: id(),
    districtId: id(),
    cityId: id(),
    streetId: id(),
    postalCode: text(16),
    residentialAddress: text(1000),
    actualAddress: text(1000),
    preferredLanguage: fb.control<PreferredLanguage | null>(null),
    fileId: id(),
    additionalInformation: text(4000),
  });
}

export interface FieldError {
  key: string;
  params?: Record<string, number>;
}

/** Первая ошибка контрола → ключ `personal.errors.*`; показывается только после касания. */
export function fieldError(control: AbstractControl): FieldError | null {
  const errors = control.errors;

  if (!errors || !control.touched) return null;
  if (errors['required']) return { key: 'personal.errors.required' };

  const maxLength = errors['maxlength'] as { requiredLength: number } | undefined;

  if (maxLength) return { key: 'personal.errors.max-length', params: { max: maxLength.requiredLength } };
  if (errors['email']) return { key: 'personal.errors.email' };
  if (errors['pastDate']) return { key: 'personal.errors.past-date' };
  if (errors['pattern']) return { key: 'personal.errors.pattern' };

  return { key: 'personal.errors.invalid' };
}
