import { type ValidatorFn, Validators } from '@angular/forms';

/** ПИН (ИНН физлица): 14 цифр. */
export const PIN_PATTERN = /^\d{14}$/;
/** Код этапа (тест, эссе): 6 символов латиницы и цифр. */
export const STAGE_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

export const pinValidator: ValidatorFn = Validators.pattern(PIN_PATTERN);
export const stageCodeValidator: ValidatorFn = Validators.pattern(STAGE_CODE_PATTERN);

/** Дата окончания не раньше даты начала; ошибка вешается на группу. */
export function dateRangeValidator(startKey: string, endKey: string): ValidatorFn {
  return (group) => {
    const start: unknown = group.get(startKey)?.value;
    const end: unknown = group.get(endKey)?.value;

    if (typeof start !== 'string' || typeof end !== 'string' || !start || !end) return null;

    return end < start ? { dateRange: true } : null;
  };
}
