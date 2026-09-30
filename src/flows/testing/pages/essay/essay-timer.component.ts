import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import { formatCountdown, type TimerLevel } from './essay.logic';

const LEVEL_CLASSES: Record<TimerLevel, string> = {
  normal: 'bg-surface-100 text-surface-800',
  warn: 'bg-orange-100 text-orange-900',
  danger: 'bg-red-100 text-red-900',
};

/**
 * Обратный отсчёт. `role="timer"` не озвучивается каждую секунду; предупреждения на 5 и 1 минуте
 * объявляет живой регион страницы.
 */
@Component({
  selector: 'app-essay-timer',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-base font-semibold tabular-nums"
      [class]="classes()"
    >
      <i class="pi pi-clock" aria-hidden="true"></i>
      <span class="text-xs font-normal">{{ 'essay.timer.label' | lang }}</span>
      <span role="timer" aria-live="off" aria-atomic="true">{{ text() }}</span>
    </div>
  `,
})
export class EssayTimerComponent {
  readonly seconds = input.required<number>();
  readonly level = input<TimerLevel>('normal');

  protected readonly text = computed(() => formatCountdown(this.seconds()));
  protected readonly classes = computed(() => LEVEL_CLASSES[this.level()]);
}
