import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import { judgeApplicationStages, type JudgeApplicationStatus, type StageState } from './judge-application.model';

const ICONS: Record<StageState, string> = {
  done: 'pi-check-circle text-green-600',
  current: 'pi-clock text-primary',
  rejected: 'pi-times-circle text-red-600',
  upcoming: 'pi-circle text-surface-400',
};

/** Ход рассмотрения заявки судьи: подача → секретарь → документы → профоценка → собеседование. */
@Component({
  selector: 'app-judge-application-progress',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="m-0 grid list-none grid-cols-1 gap-3 p-0 tablet:grid-cols-5 tablet:gap-2">
      @for (stage of stages(); track stage.key; let index = $index) {
        <li class="flex items-center gap-2 tablet:flex-col tablet:items-start">
          <div class="flex items-center gap-2 tablet:w-full">
            <i class="pi text-lg" [class]="icon(stage.state)"></i>
            @if (index < stages().length - 1) {
              <span
                class="hidden h-px flex-1 tablet:block"
                [class.bg-green-600]="stage.state === 'done'"
                [class.bg-surface-200]="stage.state !== 'done'"
              ></span>
            }
          </div>
          <span
            class="text-sm"
            [class.font-semibold]="stage.state === 'current' || stage.state === 'rejected'"
            [class.text-surface-500]="stage.state === 'upcoming'"
          >
            {{ 'judge-applications.stages.' + stage.key | lang }}
          </span>
        </li>
      }
    </ol>
  `,
})
export class JudgeApplicationProgressComponent {
  readonly status = input<JudgeApplicationStatus | null | undefined>(null);

  protected readonly stages = computed(() => judgeApplicationStages(this.status()));

  protected icon(state: StageState): string {
    return ICONS[state];
  }
}
