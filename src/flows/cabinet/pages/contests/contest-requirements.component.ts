import { ChangeDetectionStrategy, Component, computed, inject, input, type Signal } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';

import type { DirectoryCode, Schemas } from '@domain/api/api.types';
import { DirectoryStore } from '@domain/stores/directory.store';
import { localized } from '@shared/lib/language';

type Contest = Schemas['ContestResponse'];
type Item = Schemas['DirectoryItemResponse'];

/** Поле требования в `ContestResponse` → справочник и подпись `contests.detail.requirement.<label>`. */
const REQUIREMENTS = [
  { key: 'ageRequirementId', code: 'AGE_REQUIREMENT', label: 'age' },
  { key: 'educationRequirementId', code: 'EDUCATION_REQUIREMENT', label: 'education' },
  { key: 'workExperienceRequirementId', code: 'WORK_EXPERIENCE_REQUIREMENT', label: 'work-experience' },
  { key: 'citizenshipId', code: 'CITIZENSHIP', label: 'citizenship' },
  { key: 'languageLevelId', code: 'LANGUAGE_LEVEL', label: 'language-level' },
] as const satisfies readonly { key: keyof Contest; code: DirectoryCode; label: string }[];

/** Требования к кандидатам и перечень обязательных документов конкурса: подписи — из справочников. */
@Component({
  selector: 'app-contest-requirements',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    <section class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <h2 class="m-0 mb-3 text-base font-semibold">{{ 'contests.detail.requirements' | lang }}</h2>
      @if (requirements().length) {
        <dl class="m-0 grid grid-cols-1 gap-3 text-sm tablet:grid-cols-2">
          @for (row of requirements(); track row.label) {
            <div class="flex flex-col gap-0.5">
              <dt class="text-surface-500">{{ 'contests.detail.requirement.' + row.label | lang }}</dt>
              <dd class="m-0 font-medium break-words">{{ row.value || '—' }}</dd>
            </div>
          }
        </dl>
      } @else {
        <p class="m-0 text-sm text-surface-500">{{ 'contests.detail.requirements-empty' | lang }}</p>
      }
    </section>

    <section class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <h2 class="m-0 mb-1 text-base font-semibold">{{ 'contests.detail.documents' | lang }}</h2>
      <p class="m-0 mb-3 text-sm text-surface-500">{{ 'contests.detail.documents-hint' | lang }}</p>
      @if (documents().length) {
        <ul class="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          @for (document of documents(); track document.id) {
            <li class="flex items-start gap-2">
              <i class="pi pi-file mt-0.5 text-primary" aria-hidden="true"></i>
              <span class="break-words">{{ document.name || '—' }}</span>
            </li>
          }
        </ul>
      } @else {
        <p class="m-0 text-sm text-surface-500">{{ 'contests.detail.documents-empty' | lang }}</p>
      }
    </section>
  `,
})
export class ContestRequirementsComponent {
  private readonly directories = inject(DirectoryStore);
  private readonly lang = inject(LangService);

  readonly contest = input.required<Contest>();

  /** Справочники загружаются один раз за вкладку (кеш `DirectoryStore`). */
  private readonly items = new Map<DirectoryCode, Signal<Item[]>>(
    [...REQUIREMENTS.map((row) => row.code), 'DOCUMENT_TYPE' as const].map((code) => [
      code,
      this.directories.items(code),
    ]),
  );

  protected readonly requirements = computed(() => {
    const contest = this.contest();

    return REQUIREMENTS.filter((row) => contest[row.key] != null).map((row) => ({
      label: row.label,
      value: this.nameOf(row.code, contest[row.key]),
    }));
  });

  protected readonly documents = computed(() =>
    [...new Set(this.contest().requiredDocumentTypeIds ?? [])].map((id) => ({
      id,
      name: this.nameOf('DOCUMENT_TYPE', id),
    })),
  );

  private nameOf(code: DirectoryCode, id: number | undefined): string {
    const item = this.items
      .get(code)?.()
      .find((entry) => entry.id === id);

    return item ? localized(item.nameRu, item.nameKg, this.lang.currentLang()) : '';
  }
}
