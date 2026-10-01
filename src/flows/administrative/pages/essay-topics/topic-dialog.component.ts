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
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';

import type { Schemas } from '@domain/api/api.types';
import { EssayApi } from '@domain/api/essay.api';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

type Topic = Schemas['EssayTopicResponse'];

const MAX_QUESTIONS = 10;

/** Тема эссе: формулировка на двух языках, лимит времени, активность и подвопросы по порядку (`POST|PUT /essay/topic`). */
@Component({
  selector: 'app-topic-dialog',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    Button,
    Checkbox,
    Dialog,
    InputNumber,
    InputText,
    Textarea,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './topic-dialog.component.html',
})
export class TopicDialogComponent {
  private readonly api = inject(EssayApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly topic = input<Topic | null>(null);
  readonly saved = output<Topic>();

  protected readonly maxQuestions = MAX_QUESTIONS;
  protected readonly saving = signal(false);
  protected readonly editing = computed(() => this.topic() !== null);

  protected readonly form = this.fb.nonNullable.group({
    themeRu: ['', [Validators.required, Validators.maxLength(4000)]],
    themeKg: ['', [Validators.required, Validators.maxLength(4000)]],
    timeLimitMinutes: [120 as number | null, [Validators.required, Validators.min(1)]],
    active: [true],
    subQuestions: this.fb.array<FormGroup<ReturnType<TopicDialogComponent['questionGroup']>['controls']>>([]),
  });

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.open());
    });
  }

  protected get questions(): FormArray {
    return this.form.controls.subQuestions;
  }

  protected addQuestion(ru = '', kg = ''): void {
    if (this.questions.length < MAX_QUESTIONS) this.questions.push(this.questionGroup(ru, kg));
  }

  protected removeQuestion(index: number): void {
    this.questions.removeAt(index);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();
    const body: Schemas['EssayTopicRequest'] = {
      themeRu: value.themeRu.trim(),
      themeKg: value.themeKg.trim(),
      timeLimitMinutes: value.timeLimitMinutes ?? undefined,
      active: value.active,
      subQuestions: value.subQuestions.map((question) => ({
        questionRu: question.questionRu.trim(),
        questionKg: question.questionKg.trim(),
      })),
    };
    const id = this.topic()?.id;
    const request = id === undefined ? this.api.createTopic(body) : this.api.updateTopic(id, body);

    this.saving.set(true);
    request.subscribe({
      next: (topic) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('shell.form.saved'));
        this.visible.set(false);
        this.saved.emit(topic);
      },
      error: () => this.saving.set(false),
    });
  }

  private questionGroup(ru: string, kg: string) {
    return this.fb.nonNullable.group({
      questionRu: [ru, [Validators.required, Validators.maxLength(4000)]],
      questionKg: [kg, [Validators.required, Validators.maxLength(4000)]],
    });
  }

  private open(): void {
    const topic = this.topic();

    this.form.reset({
      themeRu: topic?.themeRu ?? '',
      themeKg: topic?.themeKg ?? '',
      timeLimitMinutes: topic?.timeLimitMinutes ?? 120,
      active: topic?.active ?? true,
    });
    this.questions.clear();
    [...(topic?.subQuestions ?? [])]
      .sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0))
      .forEach((question) => this.addQuestion(question.questionRu ?? '', question.questionKg ?? ''));
  }
}
