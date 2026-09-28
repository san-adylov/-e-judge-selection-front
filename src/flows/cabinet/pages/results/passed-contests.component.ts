import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import { formatScore } from '@features/rating/score-breakdown';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';

import type { PassedContestRow } from './results.model';

/** «Пройденные конкурсы» (`GET /contest-results/completed/my`): конкурс, место, балл, дата, ссылка на резерв. */
@Component({
  selector: 'app-passed-contests',
  imports: [LangPipe, RouterLink, Button, ServerDateTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="overflow-hidden rounded-xl border border-surface-200 bg-surface-0">
      <h2 class="m-0 border-b border-surface-200 px-4 py-3 text-lg font-semibold tablet:px-5">
        {{ 'results.passed.title' | lang }}
      </h2>
      @for (item of items(); track item.key) {
        <div
          class="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-surface-100 px-4 py-3 last:border-b-0 tablet:px-5"
        >
          <div class="min-w-0 flex-1 basis-64">
            <div class="font-medium">{{ item.contest.contestName ?? ('results.card.unnamed' | lang) }}</div>
            <div class="mt-0.5 text-sm text-surface-500">
              {{ 'results.passed.completed' | lang }}: {{ item.contest.completedAt | serverDateTime }}
            </div>
          </div>
          <dl class="m-0 flex gap-6 text-sm">
            <div>
              <dt class="text-surface-500">{{ 'results.passed.rank' | lang }}</dt>
              <dd class="m-0 font-semibold tabular-nums">{{ item.contest.rank ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-surface-500">{{ 'results.passed.score' | lang }}</dt>
              <dd class="m-0 font-semibold tabular-nums">{{ score(item.contest.totalScore) }}</dd>
            </div>
          </dl>
          @if (item.inReserve) {
            <p-button
              icon="pi pi-users"
              severity="success"
              size="small"
              routerLink="/cabinet/reserve"
              [outlined]="true"
              [label]="'results.passed.in-reserve' | lang"
            />
          }
        </div>
      }
    </section>
  `,
})
export class PassedContestsComponent {
  readonly items = input.required<PassedContestRow[]>();

  protected readonly score = formatScore;
}
