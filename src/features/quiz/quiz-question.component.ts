import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';

import { localized } from '@shared/lib/language';

import type { QuizOption, QuizQuestion } from './quiz.logic';

const LETTERS = 'АБВГДЕЖЗИКЛМН';

/**
 * Карточка одного вопроса: радиокнопки для SINGLE, флажки для MULTIPLE (нативные поля —
 * стрелки переключают варианты в группе). Сохранённый ответ показывается только для чтения.
 */
@Component({
  selector: 'app-quiz-question',
  imports: [LangPipe, Button, Message, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let q = question();
    @let answered = !!q.answered;

    <article
      class="scroll-mt-40 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5"
      [attr.aria-labelledby]="textId()"
    >
      <header class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="text-sm font-semibold text-primary">
          {{ 'quiz.question.title' | lang: { number: q.number, total: total() } }}
        </span>
        <span class="text-xs text-surface-500">{{ hintKey() | lang }}</span>
        @if (answered) {
          <p-tag class="ml-auto" severity="success" icon="pi pi-check" [value]="'quiz.question.saved' | lang" />
        }
      </header>

      <h2
        class="m-0 mb-4 whitespace-pre-line text-base font-medium leading-relaxed focus:outline-none tablet:text-lg"
        tabindex="-1"
        [id]="textId()"
      >
        {{ text(q.textRu, q.textKg) }}
      </h2>

      <fieldset class="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" [disabled]="answered || locked() || saving()">
        <legend class="sr-only">{{ 'quiz.question.options' | lang }}</legend>
        @for (option of q.options ?? []; track option.id; let i = $index) {
          @let checked = isSelected(option);
          <label
            class="flex min-h-12 items-start gap-3 rounded-lg border px-3 py-3 transition-colors"
            [class]="
              checked
                ? 'border-primary bg-primary-50'
                : 'border-surface-200 ' + (answered || locked() ? '' : 'cursor-pointer hover:bg-surface-50')
            "
          >
            <input
              class="mt-0.5 size-5 shrink-0 accent-primary"
              [type]="multiple() ? 'checkbox' : 'radio'"
              [name]="'quiz-q-' + q.number"
              [checked]="checked"
              (change)="optionToggle.emit(option.id ?? 0)"
            />
            <span class="w-5 shrink-0 font-semibold text-surface-500" aria-hidden="true">{{ letter(i) }}</span>
            <span class="min-w-0 whitespace-pre-line break-words">{{ text(option.textRu, option.textKg) }}</span>
          </label>
        }
      </fieldset>

      @if (error() !== null) {
        <p-message class="mt-3 block" severity="error" [text]="error() || ('quiz.question.save-error' | lang)" />
      }

      @if (!answered) {
        <div class="mt-4 flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:gap-4">
          <p-button
            styleClass="w-full tablet:w-auto"
            icon="pi pi-check"
            [label]="(error() !== null ? 'quiz.question.retry' : 'quiz.question.save') | lang"
            [loading]="saving()"
            [disabled]="!selection().length || locked()"
            (onClick)="save.emit()"
          />
          <span class="text-xs text-surface-500">{{ 'quiz.question.save-hint' | lang }}</span>
        </div>
      }
    </article>
  `,
})
export class QuizQuestionComponent {
  private readonly lang = inject(LangService);

  readonly question = input.required<QuizQuestion>();
  readonly total = input(0);
  readonly selection = input<readonly number[]>([]);
  readonly saving = input(false);
  /** Ошибка сохранения: `null` — нет, пустая строка — общая. */
  readonly error = input<string | null>(null);
  /** Время вышло или тест завершается. */
  readonly locked = input(false);

  readonly optionToggle = output<number>();
  readonly save = output<void>();

  protected readonly multiple = computed(() => this.question().choiceType === 'MULTIPLE');
  protected readonly hintKey = computed(() => (this.multiple() ? 'quiz.question.multiple' : 'quiz.question.single'));
  protected readonly textId = computed(() => `quiz-q-text-${this.question().number}`);

  protected text(ru: string | undefined, kg: string | undefined): string {
    return localized(ru, kg, this.lang.currentLang());
  }

  protected isSelected(option: QuizOption): boolean {
    return option.id !== undefined && this.selection().includes(option.id);
  }

  protected letter(index: number): string {
    return LETTERS[index] ?? String(index + 1);
  }
}
