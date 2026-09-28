import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Textarea } from 'primeng/textarea';

import { FileLinkComponent } from '@features/files/file-link.component';
import { FileUploadComponent } from '@features/files/file-upload.component';
import { localized } from '@shared/lib/language';

import { ANSWER_MAX_LENGTH, type AnswerBinding, type AnswerRow, answerValue } from './answers';
import { DossierStore } from './dossier.store';

/** Один вопрос анкеты: текст ответа (до 4000 символов) и необязательный файл, сохранение по кнопке. */
@Component({
  selector: 'app-answer-item',
  imports: [ReactiveFormsModule, LangPipe, Button, Textarea, FileLinkComponent, FileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4">
      <div class="flex items-start gap-3">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-800"
          >{{ index() }}</span
        >
        <p class="m-0 min-w-0 flex-1 font-medium">{{ text() }}</p>
        @if (row().answer) {
          <i class="pi pi-check-circle mt-1 text-green-600" [title]="'wizard.answers.saved' | lang"></i>
        }
      </div>

      @if (readonly()) {
        <p class="m-0 whitespace-pre-line text-sm text-surface-700">
          {{ row().answer?.answer || ('wizard.answers.no-answer' | lang) }}
        </p>
        @if (row().answer?.fileId; as fileId) {
          <app-file-link [fileId]="fileId" />
        }
      } @else {
        <form class="flex flex-col gap-3" [formGroup]="form" (ngSubmit)="save()">
          <textarea
            pTextarea
            rows="4"
            class="w-full"
            formControlName="answer"
            [attr.aria-label]="text()"
            [attr.maxlength]="maxLength"
            [placeholder]="'wizard.answers.placeholder' | lang"
          ></textarea>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <app-file-upload category="ADDITIONAL_INFO" formControlName="fileId" />
            <span class="text-xs text-surface-500">{{ length() }} / {{ maxLength }}</span>
          </div>
          @if (form.controls.answer.touched && form.controls.answer.invalid) {
            <small class="text-red-600">{{ 'wizard.answers.required' | lang }}</small>
          }
          <div class="flex justify-end">
            <p-button
              type="submit"
              size="small"
              icon="pi pi-save"
              [label]="'shell.actions.save' | lang"
              [loading]="saving()"
              [disabled]="!dirty()"
            />
          </div>
        </form>
      }
    </article>
  `,
})
export class AnswerItemComponent {
  private readonly store = inject(DossierStore);
  private readonly lang = inject(LangService);

  readonly row = input.required<AnswerRow>();
  readonly binding = input.required<AnswerBinding>();
  readonly index = input(1);
  readonly readonly = input(false);

  protected readonly maxLength = ANSWER_MAX_LENGTH;
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  protected readonly length = signal(0);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    answer: ['', [Validators.required, Validators.maxLength(ANSWER_MAX_LENGTH), Validators.pattern(/\S/)]],
    fileId: [null as number | null],
  });

  protected readonly text = computed(() => {
    const { question } = this.row();

    return localized(question.textRu, question.textKg, this.lang.currentLang());
  });

  /** Сохранённое значение; строки списка пересобираются при каждом сохранении, поэтому сравниваем по содержимому. */
  private readonly saved = computed(() => answerValue(this.row().answer), {
    equal: (a, b) => a.answer === b.answer && a.fileId === b.fileId,
  });

  constructor() {
    // Сохранённый ответ приходит из стора — форма показывает его и снова «чистая». Несохранённые правки
    // в соседних вопросах при этом не сбрасываются.
    effect(() => {
      const value = this.saved();

      untracked(() => {
        this.form.reset(value);
        this.dirty.set(false);
        this.length.set(value.answer.length);
      });
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.dirty.set(this.form.dirty);
      this.length.set(this.form.controls.answer.value.length);
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    this.store.saveAnswer(this.binding(), this.row(), this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.markAsPristine();
        this.dirty.set(false);
      },
      error: () => this.saving.set(false),
    });
  }
}
