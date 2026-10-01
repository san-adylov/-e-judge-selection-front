import type { AbstractControl } from '@angular/forms';

export interface FormFieldError {
  /** Ключ i18n `shell.form.*`. */
  key: string;
  params?: Record<string, number>;
}

/**
 * Первая ошибка контрола → ключ `shell.form.*`; показывается только после касания.
 * Для экранов сотрудников: одни и те же тексты ошибок на всех формах.
 */
export function formFieldError(control: AbstractControl): FormFieldError | null {
  const errors = control.errors;

  if (!errors || !control.touched) return null;
  if (errors['required']) return { key: 'shell.form.required' };

  const maxLength = errors['maxlength'] as { requiredLength: number } | undefined;

  if (maxLength) return { key: 'shell.form.max-length', params: { max: maxLength.requiredLength } };

  const min = errors['min'] as { min: number } | undefined;

  if (min) return { key: 'shell.form.min', params: { min: min.min } };
  if (errors['dateRange']) return { key: 'shell.form.date-range' };
  if (errors['email']) return { key: 'shell.form.email' };
  if (errors['pattern']) return { key: 'shell.form.pattern' };

  return { key: 'shell.form.invalid' };
}
