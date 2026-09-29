import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  type Signal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LangPipe, LangService } from '@reforgium/presentia';

import type { DirectoryCode, Schemas } from '@domain/api/api.types';
import { DirectoryApi } from '@domain/api/directory.api';
import { DirectoryStore } from '@domain/stores/directory.store';
import { skipErrorToast } from '@shared/api/http-context';
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
  private readonly api = inject(DirectoryApi);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  readonly contest = input.required<Contest>();

  /** Справочники загружаются один раз за вкладку (кеш `DirectoryStore`); в них только активные записи. */
  private readonly lists = new Map<DirectoryCode, { items: Signal<Item[]>; loaded: Signal<boolean> }>(
    [...REQUIREMENTS.map((row) => row.code), 'DOCUMENT_TYPE' as const].map((code) => [
      code,
      { items: this.directories.items(code), loaded: this.directories.loaded(code) },
    ]),
  );

  /** Выключенные записи, на которые ссылается конкурс: `CODE:id` → запись из `GET /directory/{CODE}/{id}`. */
  private readonly inactive = signal<ReadonlyMap<string, Item>>(new Map());
  private readonly requested = new Set<string>();

  /** Все ссылки конкурса на справочники. */
  private readonly references = computed<{ code: DirectoryCode; id: number }[]>(() => {
    const contest = this.contest();
    const rows = REQUIREMENTS.flatMap((row) => {
      const id = contest[row.key];

      return id == null ? [] : [{ code: row.code, id }];
    });
    const documents = [...new Set(contest.requiredDocumentTypeIds ?? [])].map((id) => ({
      code: 'DOCUMENT_TYPE' as const,
      id,
    }));

    return [...rows, ...documents];
  });

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

  constructor() {
    // Администратор мог выключить запись после публикации: её нет в `/all`, догружаем по id.
    effect(() => {
      const missing = this.references().filter(
        ({ code, id }) => this.lists.get(code)?.loaded() && !this.activeItem(code, id),
      );

      untracked(() => missing.forEach(({ code, id }) => this.resolve(code, id)));
    });
  }

  private resolve(code: DirectoryCode, id: number): void {
    const key = `${code}:${id}`;

    if (this.requested.has(key)) return;

    this.requested.add(key);
    this.api
      .get(code, id, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => this.inactive.update((items) => new Map(items).set(key, item)),
        error: () => undefined,
      });
  }

  private activeItem(code: DirectoryCode, id: number | undefined): Item | undefined {
    return this.lists
      .get(code)
      ?.items()
      .find((entry) => entry.id === id);
  }

  private nameOf(code: DirectoryCode, id: number | undefined): string {
    const item = this.activeItem(code, id) ?? this.inactive().get(`${code}:${id}`);

    return item ? localized(item.nameRu, item.nameKg, this.lang.currentLang()) : '';
  }
}
