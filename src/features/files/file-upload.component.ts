import { ChangeDetectionStrategy, Component, effect, forwardRef, inject, input, output, signal } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import type { FileCategory, Schemas } from '@domain/api/api.types';
import { FilesApi } from '@domain/api/files.api';

import { FileLinkComponent } from './file-link.component';

/**
 * Поле формы «файл»: загружает через `POST /v1/file/upload` и хранит в форме id файла (`fileId`).
 * `<app-file-upload category="CANDIDATE_DOCUMENT" formControlName="fileId" />`.
 */
@Component({
  selector: 'app-file-upload',
  imports: [LangPipe, Button, FileLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FileUploadComponent), multi: true }],
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <input #picker type="file" class="hidden" [accept]="accept()" (change)="upload($event)" />
      <p-button
        icon="pi pi-upload"
        severity="secondary"
        size="small"
        [outlined]="true"
        [label]="(fileId() ? 'shell.files.replace' : 'shell.files.choose') | lang"
        [loading]="uploading()"
        [disabled]="disabled()"
        (onClick)="picker.click()"
      />
      @if (fileId(); as id) {
        <app-file-link [fileId]="id" [name]="fileName()" />
        @if (!disabled()) {
          <p-button
            icon="pi pi-times"
            severity="secondary"
            size="small"
            [text]="true"
            [ariaLabel]="'shell.actions.delete' | lang"
            (onClick)="clear()"
          />
        }
      }
    </div>
  `,
})
export class FileUploadComponent implements ControlValueAccessor {
  private readonly files = inject(FilesApi);

  readonly category = input.required<FileCategory>();
  readonly accept = input('.pdf,.jpg,.jpeg,.png,.doc,.docx');
  /** Для загрузки файла от имени другого пользователя (сотрудник). */
  readonly ownerUserId = input<number | undefined>(undefined);

  protected readonly fileId = signal<number | null>(null);
  protected readonly fileName = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly disabled = signal(false);

  /** Идёт загрузка: форма-владелец блокирует сохранение, чтобы не отправить запись без файла. */
  readonly uploadingChange = output<boolean>();

  constructor() {
    effect(() => this.uploadingChange.emit(this.uploading()));
  }

  writeValue(value: unknown): void {
    this.fileId.set(typeof value === 'number' ? value : null);
    this.fileName.set(null);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    input.value = '';

    if (!file) return;

    this.uploading.set(true);
    this.files.upload(file, this.category(), this.ownerUserId()).subscribe({
      next: (ref: Schemas['StoredFileRef']) => {
        this.uploading.set(false);
        this.fileId.set(ref.id ?? null);
        this.fileName.set(ref.fileName ?? file.name);
        this.onChange(ref.id ?? null);
        this.onTouched();
      },
      error: () => this.uploading.set(false),
    });
  }

  protected clear(): void {
    this.fileId.set(null);
    this.fileName.set(null);
    this.onChange(null);
    this.onTouched();
  }

  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
}
