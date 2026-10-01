import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Timeline } from 'primeng/timeline';

import type { Schemas, StageKind } from '@domain/api/api.types';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';

type Contest = Schemas['ContestResponse'];
type Step = Schemas['ContestStepResponse'];
type Window = Schemas['StageWindowResponse'];

const WINDOWS = [
  { stage: 'TESTING', key: 'testingWindow' },
  { stage: 'ESSAY', key: 'essayWindow' },
  { stage: 'INTERVIEW', key: 'interviewWindow' },
] as const satisfies readonly { stage: StageKind; key: keyof Contest }[];

/** Сроки этапов (тестирование, письменное задание, собеседование) и календарный план конкурса. */
@Component({
  selector: 'app-contest-schedule',
  imports: [LangPipe, Timeline, ServerDateTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <h2 class="m-0 text-base font-semibold">{{ 'contests.detail.schedule' | lang }}</h2>

      @if (windows().length) {
        <dl class="m-0 grid grid-cols-1 gap-3 text-sm tablet:grid-cols-3">
          @for (row of windows(); track row.stage) {
            <div class="flex flex-col gap-0.5 rounded-lg bg-surface-50 p-3">
              <dt class="text-surface-500">{{ 'contests.detail.stage.' + row.stage | lang }}</dt>
              <dd class="m-0 font-medium">
                {{ row.window.start | serverDateTime }}
                @if (row.window.end) {
                  <span class="text-surface-500">—</span> {{ row.window.end | serverDateTime }}
                }
              </dd>
            </div>
          }
        </dl>
      }

      @if (steps().length) {
        <div class="flex flex-col gap-2">
          <h3 class="m-0 text-sm font-semibold text-surface-700">{{ 'contests.detail.plan' | lang }}</h3>
          <p-timeline [value]="steps()" align="left" class="[&_.p-timeline-event-opposite]:hidden">
            <ng-template #content let-step>
              <div class="flex flex-col gap-0.5 pb-4">
                <span class="text-sm font-medium">{{ 'contests.detail.step.' + step.type | lang }}</span>
                <span class="text-xs text-surface-500">
                  {{ step.start | serverDateTime }}
                  @if (step.end) {
                    — {{ step.end | serverDateTime }}
                  }
                </span>
              </div>
            </ng-template>
          </p-timeline>
        </div>
      }

      @if (!windows().length && !steps().length) {
        <p class="m-0 text-sm text-surface-500">{{ 'contests.detail.schedule-empty' | lang }}</p>
      }
    </section>
  `,
})
export class ContestScheduleComponent {
  /** Полная карточка конкурса; без неё (нет доступа) показывается только календарный план. */
  readonly contest = input<Contest | null>(null);
  readonly plan = input<readonly Step[]>([]);

  protected readonly windows = computed(() => {
    const contest = this.contest();

    if (!contest) return [];

    return WINDOWS.map(({ stage, key }) => ({ stage, window: contest[key] })).filter(
      (row): row is { stage: StageKind; window: Window } => !!row.window?.start || !!row.window?.end,
    );
  });

  /** Этапы плана по `order`; без типа этап не показывается. */
  protected readonly steps = computed(() =>
    this.plan()
      .filter((step) => !!step.type)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );
}
