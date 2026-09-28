import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import {
  DEFAULT_SCORE_WEIGHTS,
  formatScore,
  type RatingEntry,
  scoreBreakdown,
  type ScoreWeights,
} from './score-breakdown';

/**
 * Расшифровка итогового балла одной строки рейтинга: полоса на каждую составляющую (доля от её веса)
 * и полоса итога с отметкой проходного балла. Используется в кабинете и на экранах рейтинга Совета.
 */
@Component({
  selector: 'app-score-breakdown',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let view = summary();
    <div class="flex flex-col gap-3">
      @for (part of view.parts; track part.key) {
        <div>
          <div class="flex items-baseline justify-between gap-3 text-sm">
            <span class="text-surface-700">{{ 'results.part.' + part.key | lang }}</span>
            <span class="shrink-0 tabular-nums">
              <span class="font-medium">{{ part.scoreLabel }}</span>
              <span class="text-surface-500"> / {{ part.maxLabel }}</span>
            </span>
          </div>
          <div
            class="mt-1 h-2 overflow-hidden rounded-full bg-surface-100"
            role="progressbar"
            aria-valuemin="0"
            [attr.aria-valuemax]="part.max"
            [attr.aria-valuenow]="part.score"
            [attr.aria-label]="'results.part.' + part.key | lang"
          >
            <div class="h-full rounded-full bg-primary" [style.width.%]="part.percent"></div>
          </div>
        </div>
      }

      <div class="border-t border-surface-100 pt-3">
        <div class="flex items-baseline justify-between gap-3">
          <span class="font-semibold">{{ 'results.breakdown.total' | lang }}</span>
          <span class="shrink-0 tabular-nums">
            <span class="text-lg font-semibold">{{ view.totalLabel }}</span>
            <span class="text-sm text-surface-500"> / {{ view.maxLabel }}</span>
          </span>
        </div>
        <div
          class="relative mt-1 h-3 rounded-full bg-surface-100"
          role="progressbar"
          aria-valuemin="0"
          [attr.aria-valuemax]="view.max"
          [attr.aria-valuenow]="view.total"
          [attr.aria-label]="'results.breakdown.total' | lang"
        >
          <div
            class="h-full rounded-full"
            [class.bg-emerald-500]="view.passed"
            [class.bg-amber-400]="!view.passed"
            [style.width.%]="view.percent"
          ></div>
          <div
            class="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-surface-700"
            [style.left.%]="view.passingPercent"
          ></div>
        </div>
        <p class="m-0 mt-1.5 text-xs text-surface-500">
          {{ 'results.breakdown.passing' | lang }}: <span class="tabular-nums">{{ view.passingLabel }}</span>
        </p>
      </div>
    </div>
  `,
})
export class ScoreBreakdownComponent {
  readonly entry = input.required<RatingEntry>();
  /** Веса составляющих и проходной балл; по умолчанию — значения бэкенда по умолчанию. */
  readonly weights = input<ScoreWeights>(DEFAULT_SCORE_WEIGHTS);

  protected readonly summary = computed(() => {
    const summary = scoreBreakdown(this.entry(), this.weights());

    return {
      ...summary,
      parts: summary.parts.map((part) => ({
        ...part,
        scoreLabel: formatScore(part.score),
        maxLabel: formatScore(part.max),
      })),
      totalLabel: formatScore(summary.total),
      maxLabel: formatScore(summary.max),
      passingLabel: formatScore(summary.passing),
    };
  });
}
