import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';

import type { PaletteItem } from './quiz.logic';

/** Сетка номеров вопросов: сохранён / без ответа / выбран, но не сохранён; текущий обведён. */
@Component({
  selector: 'app-quiz-palette',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="'quiz.nav.palette-title' | lang">
      <ol class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2 p-0">
        @for (item of items(); track item.number) {
          <li>
            <button
              type="button"
              class="flex h-11 w-full items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              [class]="itemClass(item)"
              [attr.aria-current]="item.current ? 'step' : null"
              [attr.aria-label]="label(item)"
              (click)="go.emit(item.number)"
            >
              @if (item.saving) {
                <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
              } @else {
                {{ item.number }}
              }
            </button>
          </li>
        }
      </ol>

      <ul class="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-surface-500">
        <li class="flex items-center gap-1.5">
          <span class="size-3 rounded bg-primary" aria-hidden="true"></span>{{ 'quiz.nav.legend-answered' | lang }}
        </li>
        <li class="flex items-center gap-1.5">
          <span class="size-3 rounded border border-surface-300 bg-surface-0" aria-hidden="true"></span>
          {{ 'quiz.nav.legend-unanswered' | lang }}
        </li>
        <li class="flex items-center gap-1.5">
          <span class="size-3 rounded border border-dashed border-primary bg-primary-50" aria-hidden="true"></span>
          {{ 'quiz.nav.legend-draft' | lang }}
        </li>
      </ul>
    </nav>
  `,
})
export class QuizPaletteComponent {
  private readonly lang = inject(LangService);

  readonly items = input<PaletteItem[]>([]);
  readonly go = output<number>();

  protected itemClass(item: PaletteItem): string {
    const ring = item.current ? ' ring-2 ring-primary ring-offset-2' : '';

    if (item.failed) return 'border-red-400 bg-red-50 text-red-700' + ring;
    if (item.answered) return 'border-primary bg-primary text-primary-contrast' + ring;
    if (item.draft) return 'border-dashed border-primary bg-primary-50 text-primary-800' + ring;

    return 'border-surface-300 bg-surface-0 text-surface-700 hover:bg-surface-50' + ring;
  }

  protected label(item: PaletteItem): string {
    const state = item.saving
      ? 'saving'
      : item.failed
        ? 'failed'
        : item.answered
          ? 'answered'
          : item.draft
            ? 'draft'
            : 'unanswered';

    return `${this.lang.get('quiz.nav.item', { number: item.number })}: ${this.lang.get(`quiz.nav.state-${state}`)}`;
  }
}
