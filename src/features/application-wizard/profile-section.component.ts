import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';

import { ProfileSectionsApi, type SectionRequest } from '@domain/api/profile-sections.api';
import { DirectoryStore } from '@domain/stores/directory.store';
import { FileLinkComponent } from '@features/files/file-link.component';
import { FileUploadComponent } from '@features/files/file-upload.component';

import type { SectionConfig, SectionField } from './section-config';
import { SectionDisplay } from './section-display';
import { directoryContext, isFieldRequired, rebuildSectionForm, revalidateConditional } from './section-form';
import { SectionImportButtonComponent } from './section-import-button.component';
import { fileIdOf, formValueToBody, recordToFormValue, type RecordValue, sourceLabelKey } from './section-mapping';

/**
 * Универсальный раздел личного дела: список записей + форма, собранная из `SectionConfig`.
 * `userId` — просмотр чужого личного дела сотрудником (только чтение).
 * Импортированные из реестров записи (`source`) бэкенд разрешает менять и удалять так же, как ручные.
 */
@Component({
  selector: 'app-profile-section',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    Button,
    Checkbox,
    DatePicker,
    Dialog,
    InputText,
    Select,
    Skeleton,
    Tag,
    Textarea,
    FileLinkComponent,
    FileUploadComponent,
    SectionImportButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-section.component.html',
})
export class ProfileSectionComponent {
  private readonly api = inject(ProfileSectionsApi);
  private readonly directories = inject(DirectoryStore);
  private readonly confirm = inject(ConfirmationService);
  private readonly lang = inject(LangService);

  readonly config = input.required<SectionConfig>();
  readonly userId = input<number | undefined>(undefined);
  readonly readonly = input(false);

  /** Число активных записей после каждой загрузки — для сводки о полноте личного дела. */
  readonly loaded = output<number>();

  protected readonly records = signal<RecordValue[]>([]);
  /** Записи RELATIVE для поля `relativeId` (имущество родственника). */
  protected readonly relatives = signal<RecordValue[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly dialogOpen = signal(false);
  protected readonly form = new FormRecord<FormControl<unknown>>({});

  protected readonly directoryOptions = computed(() => {
    const entries = this.config()
      .fields.filter((field) => field.directory)
      .map((field) => [field.key, this.directories.options(field.directory!)] as const);

    return Object.fromEntries(entries);
  });

  /** Импорт из реестров — только для своего личного дела. */
  protected readonly importAction = computed(() =>
    this.readonly() || this.userId() !== undefined ? undefined : this.config().importAction,
  );

  protected readonly display = new SectionDisplay(this.config, this.directoryOptions, this.relatives, this.lang);
  protected readonly sourceLabelKey = sourceLabelKey;
  protected readonly fileIdOf = fileIdOf;
  private readonly context = directoryContext(this.directories);

  constructor() {
    effect(() => {
      const config = this.config();
      const userId = this.userId();

      untracked(() => {
        rebuildSectionForm(this.form, config, this.context);
        this.load(userId);
      });
    });

    // Условная обязательность и проверка периода зависят от других полей.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => revalidateConditional(this.form, this.config()));
  }

  protected enumOptions(field: SectionField): { label: string; value: string }[] {
    return (field.options ?? []).map((value) => ({ label: this.lang.get(`profile.enum.${value}`), value }));
  }

  protected isRequired(field: SectionField): boolean {
    return isFieldRequired(field, this.form, this.context);
  }

  protected open(record?: RecordValue): void {
    const config = this.config();

    if (this.hasRelativeField()) this.loadRelatives();

    this.form.reset(recordToFormValue(config.fields, record), { emitEvent: false });
    revalidateConditional(this.form, config);
    this.editingId.set(record?.id ?? null);
    this.dialogOpen.set(true);
  }

  protected save(): void {
    const config = this.config();

    revalidateConditional(this.form, config);

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const { section, fields } = config;
    // Тело собрано по конфигурации раздела; полную проверку делает бэкенд (4001 с `fields`).
    const body = formValueToBody(fields, this.form.getRawValue()) as unknown as SectionRequest<typeof section>;
    const id = this.editingId();
    const request = id === null ? this.api.create(section, body) : this.api.update(section, id, body);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(record: RecordValue): void {
    const id = record.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('profile.delete.title'),
      message: this.lang.get('profile.delete.message'),
      acceptLabel: this.lang.get('shell.actions.delete'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.api.remove(this.config().section, id).subscribe(() => this.reload()),
    });
  }

  protected reload(): void {
    this.load(this.userId());
  }

  private load(userId: number | undefined): void {
    this.loading.set(true);

    if (this.hasRelativeField()) this.loadRelatives();

    this.api.list(this.config().section, userId).subscribe({
      next: (records) => {
        this.records.set(records);
        this.loading.set(false);
        this.loaded.emit(records.length);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadRelatives(): void {
    this.api.list('RELATIVE', this.userId()).subscribe({ next: (records) => this.relatives.set(records) });
  }

  private hasRelativeField(): boolean {
    return this.config().fields.some((field) => field.type === 'relative');
  }
}
