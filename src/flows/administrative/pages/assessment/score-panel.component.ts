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
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';

import { AssessmentApi } from '@domain/api/assessment.api';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';

import { isValidScore, type ScoreRow, totalScore } from './assessment-rules';

/**
 * Баллы по разделам личного дела. Докладчик (`editable`) выставляет каждый раздел отдельно —
 * `PUT /document-assessment` создаёт или заменяет оценку раздела. Остальные видят итог только для чтения.
 */
@Component({
  selector: 'app-score-panel',
  imports: [FormsModule, LangPipe, ServerDateTimePipe, Button, InputNumber, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="m-0 text-base font-semibold">{{ 'staff-assessment.scores.title' | lang }}</h2>
        <span class="text-sm text-surface-600">
          {{
            'staff-assessment.scores.total'
              | lang: { score: total().score, max: total().max, scored: total().scored, sections: rows().length }
          }}
        </span>
      </div>

      @if (!editable()) {
        <p-message severity="info" icon="pi pi-eye" [text]="'staff-assessment.scores.readonly' | lang" />
      }

      @if (rows().length) {
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (row of rows(); track row.section) {
            <li
              class="flex flex-col gap-2 rounded-lg border border-surface-200 p-3 tablet:flex-row tablet:items-center"
            >
              <div class="flex min-w-0 flex-1 flex-col">
                <label class="font-medium" [for]="'score-' + row.section">
                  {{ 'staff-assessment.section.' + row.section | lang }}
                </label>
                <span class="text-xs text-surface-500">
                  {{ 'staff-assessment.scores.max' | lang: { max: row.maxScore } }}
                  @if (row.updatedAt) {
                    · {{ row.updatedAt | serverDateTime }}
                  }
                </span>
              </div>
              @if (editable()) {
                <div class="flex items-center gap-2">
                  <p-inputnumber
                    [inputId]="'score-' + row.section"
                    styleClass="w-28"
                    inputStyleClass="w-28 text-right"
                    mode="decimal"
                    [min]="0"
                    [max]="row.maxScore"
                    [step]="0.5"
                    [minFractionDigits]="0"
                    [maxFractionDigits]="2"
                    [showButtons]="true"
                    [useGrouping]="false"
                    [disabled]="saving() === row.section"
                    [ngModel]="draft()[row.section] ?? null"
                    (ngModelChange)="setDraft(row.section, $event)"
                  />
                  <p-button
                    size="small"
                    icon="pi pi-save"
                    [ariaLabel]="'shell.actions.save' | lang"
                    [loading]="saving() === row.section"
                    [disabled]="!dirty(row) || !valid(row)"
                    (onClick)="save(row)"
                  />
                </div>
              } @else {
                <span class="font-semibold tabular-nums">{{ row.score ?? '—' }} / {{ row.maxScore }}</span>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="m-0 text-sm text-surface-500">{{ 'staff-assessment.scores.empty' | lang }}</p>
      }
    </section>
  `,
})
export class ScorePanelComponent {
  private readonly api = inject(AssessmentApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly applicationId = input.required<number>();
  readonly rows = input.required<readonly ScoreRow[]>();
  readonly editable = input(false);
  /** Балл сохранён — страница перечитывает сводку. */
  readonly scored = output<void>();

  protected readonly draft = signal<Record<string, number | null>>({});
  protected readonly saving = signal<string | null>(null);
  protected readonly total = computed(() => totalScore(this.rows()));

  constructor() {
    // Сохранённые баллы — в черновик; несохранённый ввод по другим разделам не сбрасывается.
    effect(() => {
      const rows = this.rows();

      untracked(() =>
        this.draft.update((draft) => {
          const next = { ...draft };

          rows.forEach((row) => {
            if (!(row.section in next) || row.score !== null) next[row.section] = row.score;
          });

          return next;
        }),
      );
    });
  }

  protected setDraft(section: string, value: number | null): void {
    this.draft.update((draft) => ({ ...draft, [section]: value }));
  }

  protected dirty(row: ScoreRow): boolean {
    return (this.draft()[row.section] ?? null) !== row.score;
  }

  protected valid(row: ScoreRow): boolean {
    return isValidScore(this.draft()[row.section] ?? null, row.maxScore);
  }

  protected save(row: ScoreRow): void {
    const score = this.draft()[row.section] ?? null;

    if (!isValidScore(score, row.maxScore)) return;

    this.saving.set(row.section);
    this.api.scoreDocuments({ applicationId: this.applicationId(), section: row.section, score }).subscribe({
      next: () => {
        this.saving.set(null);
        this.notify.success(this.lang.get('staff-assessment.scores.saved'));
        this.scored.emit();
      },
      error: () => this.saving.set(null),
    });
  }
}
