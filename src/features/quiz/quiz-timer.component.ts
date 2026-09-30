import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import { formatCountdown, TIMER_WARNINGS, timerLevel, warningToAnnounce } from './quiz.logic';

const LEVEL_CLASSES = {
  normal: 'bg-surface-100 text-surface-800',
  warning: 'bg-amber-100 text-amber-900',
  critical: 'bg-red-100 text-red-800',
} as const;

/**
 * Обратный отсчёт до окончания теста. Секунды приходят из стора (сверка с сервером на каждом ответе).
 * За 5 и за 1 минуту — объявление для экранных дикторов и событие `warn` (страница показывает тост).
 */
@Component({
  selector: 'app-quiz-timer',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center gap-2 rounded-lg px-3 py-1.5 tabular-nums transition-colors"
      [class]="levelClass()"
      [attr.title]="'quiz.timer.label' | lang"
    >
      <i class="pi pi-clock" aria-hidden="true"></i>
      <span class="sr-only">{{ 'quiz.timer.label' | lang }}</span>
      <span role="timer" class="min-w-[4.5ch] text-lg font-semibold leading-none tablet:text-xl">{{ text() }}</span>
    </div>
    <span class="sr-only" aria-live="assertive" aria-atomic="true">
      @if (announcement(); as key) {
        {{ key | lang }}
      }
    </span>
  `,
})
export class QuizTimerComponent {
  /** `null` — время ещё не известно (тест загружается). */
  readonly seconds = input<number | null>(null);
  readonly warn = output<number>();

  private readonly announced = new Set<number>();
  protected readonly announcement = signal<string | null>(null);

  protected readonly text = computed(() => {
    const seconds = this.seconds();

    return seconds === null ? '--:--' : formatCountdown(seconds);
  });

  protected readonly levelClass = computed(() => {
    const seconds = this.seconds();

    return LEVEL_CLASSES[seconds === null ? 'normal' : timerLevel(seconds)];
  });

  constructor() {
    effect(() => {
      const seconds = this.seconds();

      if (seconds === null) return;

      const threshold = warningToAnnounce(seconds, this.announced);

      if (threshold === null) return;

      // Все пройденные пороги считаем объявленными: после перезагрузки на 30 с — только «1 минута».
      TIMER_WARNINGS.filter((value) => value >= threshold).forEach((value) => this.announced.add(value));
      untracked(() => {
        this.announcement.set(`quiz.timer.warn-${threshold}`);
        this.warn.emit(threshold);
      });
    });
  }
}
