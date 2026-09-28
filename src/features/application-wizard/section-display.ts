import { computed, type Signal } from '@angular/core';
import type { LangService } from '@reforgium/presentia';

import type { DirectoryOption } from '@domain/stores/directory.store';
import { LocalDatePipe } from '@shared/lib/format.pipes';

import type { SectionConfig } from './section-config';
import type { RecordValue } from './section-mapping';

const localDate = new LocalDatePipe();

/** Подписи записей раздела в списке: заголовок, подзаголовок, варианты «чьё имущество». */
export class SectionDisplay {
  /** Родственники для `p-select` поля `relativeId`. */
  readonly relativeOptions = computed(() =>
    this.relatives()
      .filter((relative) => relative.id !== undefined)
      .map((relative) => ({ label: this.relativeLabel(relative), value: relative.id as number })),
  );

  constructor(
    private readonly config: Signal<SectionConfig>,
    private readonly directoryOptions: Signal<Record<string, Signal<DirectoryOption[]>>>,
    private readonly relatives: Signal<RecordValue[]>,
    private readonly lang: LangService,
  ) {}

  title(record: RecordValue): string {
    return this.config()
      .titleKeys.map((key) => this.value(key, record[key]))
      .filter(Boolean)
      .join(' ');
  }

  subtitle(record: RecordValue): string {
    return this.config()
      .subtitleKeys.map((key) => this.value(key, record[key]))
      .filter(Boolean)
      .join(' · ');
  }

  /** «Фамилия Имя Отчество (степень родства)». */
  relativeLabel(relative: RecordValue): string {
    const name = ['lastName', 'firstName', 'middleName']
      .map((key) => relative[key])
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ');
    const relation = relative['relationType'];

    return typeof relation === 'string' ? `${name} (${this.lang.get(`profile.enum.${relation}`)})` : name;
  }

  private value(key: string, raw: unknown): string {
    const value = typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? raw : null;

    if (value === null || value === '') return '';

    const field = this.config().fields.find((item) => item.key === key);

    switch (field?.type) {
      case 'directory': {
        const options = this.directoryOptions()[key]?.() ?? [];

        return options.find((option) => option.value === value)?.label ?? '';
      }

      case 'relative': {
        const relative = this.relatives().find((item) => item.id === value);

        return relative ? this.relativeLabel(relative) : '';
      }

      case 'enum':
        return this.lang.get(`profile.enum.${String(value)}`);
      case 'date':
        return localDate.transform(String(value), '');
      default:
        return String(value);
    }
  }
}
