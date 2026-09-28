import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import { RatingOutcomeTagComponent } from '@features/rating/rating-outcome-tag.component';
import { ScoreBreakdownComponent } from '@features/rating/score-breakdown.component';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import type { ContestResultRow } from './results.model';

/** Карточка результата кандидата по одному конкурсу: место, исход, расшифровка балла. */
@Component({
  selector: 'app-contest-result-card',
  imports: [
    LangPipe,
    RouterLink,
    Button,
    RatingOutcomeTagComponent,
    ScoreBreakdownComponent,
    ServerDateTimePipe,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = row();
    <article class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <header class="flex flex-wrap items-start gap-3">
        <div class="min-w-0 flex-1 basis-64">
          <h2 class="m-0 text-lg leading-snug font-semibold">
            {{ item.contestName ?? ('results.card.unnamed' | lang) }}
          </h2>
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-surface-500">
            <app-status-tag kind="contestType" [value]="item.contestType" />
            @if (item.completedAt) {
              <span>{{ 'results.card.completed' | lang }}: {{ item.completedAt | serverDateTime }}</span>
            }
            @if (item.entry.registrationNumber) {
              <span>{{ 'results.card.application' | lang }} {{ item.entry.registrationNumber }}</span>
            }
          </div>
        </div>
        <app-rating-outcome-tag [entry]="item.entry" />
      </header>

      <div class="mt-4 grid gap-4 tablet:grid-cols-[9rem_minmax(0,1fr)] tablet:gap-6">
        <div
          class="flex items-center gap-3 rounded-lg bg-surface-50 p-3 tablet:flex-col tablet:items-start tablet:gap-1"
        >
          <span class="text-3xl font-semibold text-primary tabular-nums">{{ item.entry.rank ?? '—' }}</span>
          <span class="text-sm text-surface-500">{{ 'results.card.rank' | lang }}</span>
        </div>
        <app-score-breakdown [entry]="item.entry" />
      </div>

      @if (item.outcome === 'reserve') {
        <footer class="mt-4 flex flex-wrap items-center gap-3 border-t border-surface-100 pt-4">
          <p class="m-0 min-w-0 flex-1 basis-60 text-sm text-surface-600">{{ 'results.card.reserve-hint' | lang }}</p>
          <p-button
            icon="pi pi-users"
            severity="secondary"
            size="small"
            routerLink="/cabinet/reserve"
            [outlined]="true"
            [label]="'results.card.to-reserve' | lang"
          />
        </footer>
      }
    </article>
  `,
})
export class ContestResultCardComponent {
  readonly row = input.required<ContestResultRow>();
}
