import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { type FormArray, FormBuilder, type FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';

import type { Schemas } from '@domain/api/api.types';
import { QuestionsApi } from '@domain/api/questions.api';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

type Question = Schemas['QuestionResponse'];
type ChoiceType = Schemas['QuestionRequest']['choiceType'];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

/** Вопрос теста: тексты на двух языках, тип выбора и варианты с отметкой правильных (`POST|PUT /questions`). */
@Component({
  selector: 'app-question-dialog',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    Button,
    Checkbox,
    Dialog,
    InputText,
    Message,
    SelectButton,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './question-dialog.component.html',
})
export class QuestionDialogComponent {
  private readonly api = inject(QuestionsApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly categoryId = input.required<number>();
  /** `null` — создание. */
  readonly question = input<Question | null>(null);
  readonly saved = output<Question>();

  protected readonly maxOptions = MAX_OPTIONS;
  protected readonly saving = signal(false);
  protected readonly correctError = signal(false);
  protected readonly editing = computed(() => this.question() !== null);
  protected readonly choiceOptions = computed(() => {
    this.lang.currentLang();

    return (['SINGLE', 'MULTIPLE'] as const).map((value) => ({
      value,
      label: this.lang.get(`staff-tests.question.${value}`),
    }));
  });

  protected readonly form = this.fb.nonNullable.group({
    textRu: ['', [Validators.required, Validators.maxLength(4000)]],
    textKg: ['', [Validators.required, Validators.maxLength(4000)]],
    choiceType: ['SINGLE' as ChoiceType, Validators.required],
    options: this.fb.array<FormGroup<ReturnType<QuestionDialogComponent['optionGroup']>['controls']>>([]),
  });

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.open());
    });
  }

  protected get options(): FormArray {
    return this.form.controls.options;
  }

  protected addOption(textRu = '', textKg = '', correct = false): void {
    if (this.options.length < MAX_OPTIONS) this.options.push(this.optionGroup(textRu, textKg, correct));
  }

  protected removeOption(index: number): void {
    if (this.options.length > MIN_OPTIONS) this.options.removeAt(index);
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    const correct = value.options.filter((option) => option.correct).length;
    const singleOk = value.choiceType !== 'SINGLE' || correct === 1;

    this.correctError.set(correct === 0 || !singleOk);

    if (this.form.invalid || this.correctError()) {
      this.form.markAllAsTouched();

      return;
    }

    const body: Schemas['QuestionRequest'] = {
      categoryId: this.categoryId(),
      textRu: value.textRu.trim(),
      textKg: value.textKg.trim(),
      choiceType: value.choiceType,
      options: value.options.map((option) => ({
        textRu: option.textRu.trim(),
        textKg: option.textKg.trim(),
        correct: option.correct,
      })),
    };
    const id = this.question()?.id;
    const request = id === undefined ? this.api.create(body) : this.api.update(id, body);

    this.saving.set(true);
    request.subscribe({
      next: (question) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('shell.form.saved'));
        this.visible.set(false);
        this.saved.emit(question);
      },
      error: () => this.saving.set(false),
    });
  }

  private optionGroup(textRu: string, textKg: string, correct: boolean) {
    return this.fb.nonNullable.group({
      textRu: [textRu, [Validators.required, Validators.maxLength(2000)]],
      textKg: [textKg, [Validators.required, Validators.maxLength(2000)]],
      correct: [correct],
    });
  }

  private open(): void {
    const question = this.question();

    this.correctError.set(false);
    this.form.reset({
      textRu: question?.textRu ?? '',
      textKg: question?.textKg ?? '',
      choiceType: question?.choiceType ?? 'SINGLE',
    });
    this.options.clear();

    const options = question?.options ?? [];

    if (options.length)
      options.forEach((option) => this.addOption(option.textRu ?? '', option.textKg ?? '', option.correct ?? false));
    else for (let i = 0; i < MIN_OPTIONS; i++) this.addOption();
  }
}
