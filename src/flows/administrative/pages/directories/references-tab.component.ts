import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';

import type { Schemas } from '@domain/api/api.types';
import { SettingsApi } from '@domain/api/settings.api';
import { FileLinkComponent } from '@features/files/file-link.component';
import { localized } from '@shared/lib/language';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

type Reference = Schemas['ReferenceDocumentResponse'];

/** Справочные документы (`/reference`): название, описание, порядок и файл одним multipart-запросом. */
@Component({
  selector: 'app-references-tab',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    Button,
    Dialog,
    InputNumber,
    InputText,
    Skeleton,
    Textarea,
    FileLinkComponent,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './references-tab.component.html',
})
export class ReferencesTabComponent implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<Reference[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly editing = signal(false);
  protected readonly selected = signal<Reference | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly fileMissing = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    titleRu: ['', [Validators.required, Validators.maxLength(500)]],
    titleKg: ['', Validators.maxLength(500)],
    description: ['', Validators.maxLength(4000)],
    sortOrder: [null as number | null],
  });

  ngOnInit(): void {
    this.load();
  }

  protected title(item: Reference): string {
    return localized(item.titleRu, item.titleKg, this.lang.currentLang());
  }

  protected open(item: Reference | null): void {
    this.selected.set(item);
    this.file.set(null);
    this.fileMissing.set(false);
    this.form.reset({
      titleRu: item?.titleRu ?? '',
      titleKg: item?.titleKg ?? '',
      description: item?.description ?? '',
      sortOrder: item?.sortOrder ?? null,
    });
    this.editing.set(true);
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.file.set(input.files?.[0] ?? null);
    this.fileMissing.set(false);
    input.value = '';
  }

  protected submit(): void {
    const id = this.selected()?.id;
    const file = this.file();

    if (this.form.invalid || (id === undefined && !file)) {
      this.form.markAllAsTouched();
      this.fileMissing.set(id === undefined && !file);

      return;
    }

    const value = this.form.getRawValue();
    const body: Schemas['ReferenceDocumentRequest'] = {
      titleRu: value.titleRu.trim(),
      titleKg: value.titleKg.trim() || undefined,
      description: value.description.trim() || undefined,
      sortOrder: value.sortOrder ?? undefined,
    };
    const request =
      id === undefined
        ? this.api.createReference(body, file as File)
        : this.api.updateReference(id, body, file ?? undefined);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.notify.success(this.lang.get('shell.form.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(item: Reference): void {
    const id = item.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('staff-directories.references.delete-title'),
      message: this.lang.get('staff-directories.references.delete-message', { title: this.title(item) }),
      icon: 'pi pi-trash',
      acceptLabel: this.lang.get('shell.actions.delete'),
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.busy.set(id);
        this.api.removeReference(id).subscribe({
          next: () => {
            this.busy.set(null);
            this.items.update((items) => items.filter((row) => row.id !== id));
          },
          error: () => this.busy.set(null),
        });
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .references()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set([...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
