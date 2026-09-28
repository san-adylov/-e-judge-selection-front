import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import type { Confirmation } from './judge-confirmation.logic';

/** История заявок пользователя (`GET /active-judge-confirmations/my/history`, новые сверху). */
@Component({
  selector: 'app-judge-confirmation-history',
  imports: [LangPipe, ServerDateTimePipe, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="overflow-hidden rounded-xl border border-surface-200 bg-surface-0">
      <h2 class="m-0 border-b border-surface-100 p-4 text-lg font-semibold tablet:px-5">
        {{ 'judge-confirmation.history.title' | lang }}
      </h2>
      <ul class="m-0 list-none p-0">
        @for (item of items(); track item.id) {
          <li
            class="flex flex-col gap-2 border-b border-surface-100 p-4 last:border-b-0 tablet:flex-row tablet:items-start tablet:gap-4 tablet:px-5"
          >
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="font-medium">
                {{ 'judge-confirmation.state.number' | lang: { id: item.id ?? '' } }}
                @if (item.courtName) {
                  <span class="font-normal text-surface-600"> · {{ item.courtName }}</span>
                }
              </span>
              <span class="text-xs text-surface-500">
                {{ 'judge-confirmation.history.created' | lang }}: {{ item.createdAt | serverDateTime }}
                @if (item.submittedAt) {
                  · {{ 'judge-confirmation.state.submitted' | lang }}: {{ item.submittedAt | serverDateTime }}
                }
                @if (item.decidedAt) {
                  · {{ 'judge-confirmation.state.decided' | lang }}: {{ item.decidedAt | serverDateTime }}
                }
              </span>
              @if (item.rejectReason) {
                <span class="text-sm text-surface-700">
                  {{ 'judge-confirmation.state.reason' | lang }}: {{ item.rejectReason }}
                </span>
              }
            </div>
            <app-status-tag class="shrink-0" kind="judgeConfirmation" [value]="item.status" />
          </li>
        }
      </ul>
    </section>
  `,
})
export class ConfirmationHistoryComponent {
  readonly items = input.required<Confirmation[]>();
}
