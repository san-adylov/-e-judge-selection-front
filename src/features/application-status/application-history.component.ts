import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Timeline } from 'primeng/timeline';

import type { ApplicationStatus, Schemas } from '@domain/api/api.types';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

interface HistoryItem {
  status: ApplicationStatus | undefined;
  at: string | undefined;
  reason: string | undefined;
  created: boolean;
}

/** История статусов заявки: сверху — последнее изменение, внизу — создание черновика. */
@Component({
  selector: 'app-application-history',
  imports: [LangPipe, Timeline, ServerDateTimePipe, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length) {
      <p-timeline [value]="items()" align="left" class="[&_.p-timeline-event-opposite]:hidden">
        <ng-template #content let-item>
          <div class="flex flex-col items-start gap-1 pb-4">
            @if (item.created) {
              <span class="text-sm font-medium">{{ 'applications.history.created' | lang }}</span>
            } @else {
              <app-status-tag kind="application" [value]="item.status" />
            }
            <span class="text-xs text-surface-500">{{ item.at | serverDateTime }}</span>
            @if (item.reason) {
              <p class="m-0 text-sm whitespace-pre-line text-surface-700">
                <span class="text-surface-500">{{ 'applications.history.reason' | lang }}:</span>
                {{ item.reason }}
              </p>
            }
          </div>
        </ng-template>
      </p-timeline>
    } @else {
      <p class="m-0 text-sm text-surface-500">{{ 'applications.history.empty' | lang }}</p>
    }
  `,
})
export class ApplicationHistoryComponent {
  /** Записи истории в порядке бэкенда (`changedAt` по возрастанию). */
  readonly history = input<readonly Schemas['ApplicationStatusHistoryResponse'][]>([]);
  /** `createdAt` заявки: создание черновика в истории не пишется. */
  readonly createdAt = input<string | undefined>(undefined);

  protected readonly items = computed<HistoryItem[]>(() => {
    const changes = this.history()
      .map((entry) => ({ status: entry.to, at: entry.changedAt, reason: entry.reason, created: false }))
      .reverse();
    const createdAt = this.createdAt();

    return createdAt ? [...changes, { status: 'NEW', at: createdAt, reason: undefined, created: true }] : changes;
  });
}
