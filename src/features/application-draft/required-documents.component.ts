import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';

import { DirectoryStore } from '@domain/stores/directory.store';
import { FileLinkComponent } from '@features/files/file-link.component';
import { FileUploadComponent } from '@features/files/file-upload.component';
import { localized } from '@shared/lib/language';
import { NotifyService } from '@shared/ui/notify.service';

import { DossierStore } from './dossier.store';
import { missingDocumentTypeIds, type RequiredDocumentRow, requiredDocumentRows } from './required-documents';

/**
 * Обязательные документы конкурса против раздела `DOCUMENT` личного дела. Недостающий документ добавляется
 * здесь же и попадает в личное дело (общий для всех заявок).
 */
@Component({
  selector: 'app-required-documents',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    Button,
    Dialog,
    Message,
    Skeleton,
    Textarea,
    FileLinkComponent,
    FileUploadComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './required-documents.component.html',
})
export class RequiredDocumentsComponent {
  protected readonly store = inject(DossierStore);
  private readonly directories = inject(DirectoryStore);
  private readonly lang = inject(LangService);
  private readonly notify = inject(NotifyService);

  /** `ContestResponse.requiredDocumentTypeIds`. */
  readonly requiredTypeIds = input<readonly number[] | null | undefined>([]);
  readonly readonly = input(false);

  protected readonly adding = signal<RequiredDocumentRow | null>(null);
  protected readonly saving = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    fileId: [null as number | null, Validators.required],
    additionalInfo: ['', Validators.maxLength(4000)],
  });

  protected readonly rows = computed(() => requiredDocumentRows(this.requiredTypeIds(), this.store.documents()));
  protected readonly missing = computed(() => missingDocumentTypeIds(this.rows()).length);

  private readonly types = this.directories.items('DOCUMENT_TYPE');
  private readonly typeNames = computed(() => {
    const lang = this.lang.currentLang();

    return new Map(this.types().map((item) => [item.id, localized(item.nameRu, item.nameKg, lang)]));
  });

  protected typeName(typeId: number): string {
    return this.typeNames().get(typeId) || `#${typeId}`;
  }

  protected open(row: RequiredDocumentRow): void {
    this.form.reset({ fileId: null, additionalInfo: '' });
    this.adding.set(row);
  }

  protected close(): void {
    this.adding.set(null);
  }

  protected save(): void {
    const row = this.adding();
    const { fileId, additionalInfo } = this.form.getRawValue();

    if (!row || this.form.invalid || fileId === null) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    this.store
      .addDocument({ documentTypeId: row.typeId, fileId, additionalInfo: additionalInfo.trim() || undefined })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.adding.set(null);
          this.notify.success(this.lang.get('wizard.documents.added'));
        },
        error: () => this.saving.set(false),
      });
  }
}
