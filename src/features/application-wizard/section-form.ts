import { type Signal, untracked } from '@angular/core';
import { type AbstractControl, FormControl, type FormRecord, type ValidatorFn, Validators } from '@angular/forms';

import type { DirectoryCode, Schemas } from '@domain/api/api.types';
import type { DirectoryStore } from '@domain/stores/directory.store';

import type { SectionConfig, SectionField, SectionFieldContext } from './section-config';
import { dateRangeInvalid, isEmptyValue } from './section-mapping';

export type SectionForm = FormRecord<FormControl<unknown>>;

/** Контекст условий обязательности: `code` записи справочника по id, справочники — из кеша `DirectoryStore`. */
export function directoryContext(store: DirectoryStore): SectionFieldContext {
  const cache = new Map<DirectoryCode, Signal<Schemas['DirectoryItemResponse'][]>>();

  return {
    directoryCode: (directory, id) => {
      let items = cache.get(directory);

      if (!items) {
        items = untracked(() => store.items(directory));
        cache.set(directory, items);
      }

      return items().find((item) => item.id === id)?.code;
    },
  };
}

export function isFieldRequired(field: SectionField, form: SectionForm, context: SectionFieldContext): boolean {
  return !!field.required || !!field.requiredWhen?.(form.getRawValue(), context);
}

/** Пересобирает контролы формы под раздел: обязательность, длины, шаблоны, период «начало — окончание». */
export function rebuildSectionForm(form: SectionForm, config: SectionConfig, context: SectionFieldContext): void {
  Object.keys(form.controls).forEach((key) => form.removeControl(key, { emitEvent: false }));

  for (const field of config.fields) {
    const conditional: ValidatorFn = (control: AbstractControl) =>
      field.requiredWhen && isEmptyValue(control.value) && field.requiredWhen(form.getRawValue(), context)
        ? { required: true }
        : null;
    const validators: ValidatorFn[] = [conditional];

    if (field.required) validators.push(field.type === 'checkbox' ? Validators.requiredTrue : Validators.required);
    if (field.maxLength) validators.push(Validators.maxLength(field.maxLength));
    if (field.pattern) validators.push(Validators.pattern(field.pattern));

    form.addControl(field.key, new FormControl<unknown>(field.type === 'checkbox' ? false : null, validators), {
      emitEvent: false,
    });
  }

  form.setValidators(() => (dateRangeInvalid(config, form.getRawValue()) ? { dateRange: true } : null));
}

/** Условная обязательность зависит от других полей: пересчитать после изменения формы. */
export function revalidateConditional(form: SectionForm, config: SectionConfig): void {
  for (const field of config.fields) {
    if (field.requiredWhen) form.controls[field.key]?.updateValueAndValidity({ emitEvent: false });
  }

  form.updateValueAndValidity({ emitEvent: false });
}
