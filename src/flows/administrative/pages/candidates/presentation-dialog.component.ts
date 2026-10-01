import { ChangeDetectionStrategy, Component, effect, inject, input, model, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { switchMap } from 'rxjs';

import { CandidateProfileApi } from '@domain/api/candidate-profile.api';
import { DocumentsApi } from '@domain/api/documents.api';
import { SessionService } from '@shared/auth/session.service';
import { saveBlob } from '@shared/lib/download';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

/** Поля представления, которых нет в системе (`CandidatePresentationService.NARRATIVE_FIELDS`). */
const NARRATIVE_FIELDS = [
  'complaints',
  'disciplinaryActions',
  'dismissalInfo',
  'criminalRecordInfo',
  'reviews',
  'constitutionalCompliance',
] as const;

const TEXT_MAX = 4000;

/**
 * Представление кандидата (PDF): `POST /candidate/profile/{userId}/presentation` собирает данные личного дела,
 * докладчик дописывает сведения, которых в системе нет. Файл скачивается через `/documents/{id}/download`.
 */
@Component({
  selector: 'app-presentation-dialog',
  imports: [ReactiveFormsModule, LangPipe, Button, Dialog, InputText, Textarea, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-3xl mx-4"
      [modal]="true"
      [header]="'staff-candidates.presentation.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <p class="m-0 text-sm text-surface-600">{{ 'staff-candidates.presentation.hint' | lang }}</p>
        <app-form-field
          label="staff-candidates.presentation.reporter"
          inputId="presentation-reporter"
          [required]="true"
          [control]="form.controls.reporterName"
        >
          <input
            pInputText
            id="presentation-reporter"
            class="w-full"
            [maxlength]="500"
            formControlName="reporterName"
          />
        </app-form-field>
        <div class="grid grid-cols-1 gap-4 tablet:grid-cols-2">
          @for (field of fields; track field) {
            <app-form-field
              [label]="'staff-candidates.presentation.field.' + field"
              [inputId]="'presentation-' + field"
              [control]="form.controls[field]"
            >
              <textarea
                pTextarea
                class="w-full"
                rows="3"
                [id]="'presentation-' + field"
                [autoResize]="true"
                [maxlength]="textMax"
                [formControlName]="field"
              ></textarea>
            </app-form-field>
          }
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            type="submit"
            icon="pi pi-file-pdf"
            [label]="'staff-candidates.presentation.generate' | lang"
            [loading]="saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
})
export class PresentationDialogComponent {
  private readonly profiles = inject(CandidateProfileApi);
  private readonly documents = inject(DocumentsApi);
  private readonly session = inject(SessionService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly userId = input.required<number>();
  readonly visible = model(false);

  protected readonly fields = NARRATIVE_FIELDS;
  protected readonly textMax = TEXT_MAX;
  protected readonly saving = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    reporterName: ['', [Validators.required, Validators.maxLength(500)]],
    complaints: ['', Validators.maxLength(TEXT_MAX)],
    disciplinaryActions: ['', Validators.maxLength(TEXT_MAX)],
    dismissalInfo: ['', Validators.maxLength(TEXT_MAX)],
    criminalRecordInfo: ['', Validators.maxLength(TEXT_MAX)],
    reviews: ['', Validators.maxLength(TEXT_MAX)],
    constitutionalCompliance: ['', Validators.maxLength(TEXT_MAX)],
  });

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.form.reset({ reporterName: this.session.user()?.fullName ?? '' }));
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();
    const narrative: Record<string, string> = {};

    for (const field of NARRATIVE_FIELDS) {
      const text = value[field].trim();

      if (text) narrative[field] = text;
    }

    this.saving.set(true);
    this.profiles
      .presentation(this.userId(), { reporterName: value.reporterName.trim(), narrative })
      .pipe(switchMap((file) => this.documents.download(file.id ?? 0)))
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          saveBlob(response, `presentation-${this.userId()}.pdf`);
          this.notify.success(this.lang.get('staff-candidates.presentation.success'));
          this.visible.set(false);
        },
        error: () => this.saving.set(false),
      });
  }
}
