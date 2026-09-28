import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import { AnswerItemComponent } from './answer-item.component';
import { type AnswerBinding, answerRows, unansweredCount } from './answers';
import { DossierStore } from './dossier.store';

/**
 * Вопросы анкеты (`GET /additional-info/questions`) и ответы раздела `ADDITIONAL_INFO`, привязанные к заявке.
 * `binding` — `{ applicationId }` для заявки на конкурс или `{ judgeApplicationId }` для заявки судьи.
 */
@Component({
  selector: 'app-additional-answers',
  imports: [LangPipe, Button, Message, Skeleton, AnswerItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <p class="m-0 text-sm text-surface-600">{{ 'wizard.answers.hint' | lang }}</p>

      @if (store.failed()) {
        <div class="flex flex-wrap items-center gap-2">
          <p-message severity="error" [text]="'wizard.dossier-failed' | lang" />
          <p-button icon="pi pi-refresh" [text]="true" [label]="'wizard.retry' | lang" (onClick)="store.load()" />
        </div>
      } @else if (store.loading()) {
        @for (row of [1, 2]; track row) {
          <p-skeleton height="8rem" />
        }
      } @else {
        @if (unanswered() > 0 && !readonly()) {
          <p-message severity="info" [text]="'wizard.answers.unanswered' | lang: { count: unanswered() }" />
        }
        @for (row of rows(); track row.questionId; let i = $index) {
          <app-answer-item [row]="row" [binding]="binding()" [index]="i + 1" [readonly]="readonly()" />
        } @empty {
          <p class="m-0 rounded-xl border border-dashed border-surface-300 p-6 text-center text-surface-500">
            {{ 'wizard.answers.empty' | lang }}
          </p>
        }
      }
    </div>
  `,
})
export class AdditionalAnswersComponent {
  protected readonly store = inject(DossierStore);

  readonly binding = input.required<AnswerBinding>();
  readonly readonly = input(false);

  protected readonly rows = computed(() => answerRows(this.store.questions(), this.store.answers(), this.binding()));
  protected readonly unanswered = computed(() => unansweredCount(this.rows()));
}
