import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';

import type { Schemas } from '@domain/api/api.types';
import { stageDates } from '@features/application-status/application-actions';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

/** Карточка заявки в списке «Мои заявки»: вся карточка — ссылка на детальную страницу. */
@Component({
  selector: 'app-application-card',
  imports: [RouterLink, LangPipe, ServerDateTimePipe, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let app = application();
    <a
      class="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 text-inherit no-underline transition-colors hover:border-primary tablet:p-5"
      [routerLink]="['/cabinet/applications', app.id]"
    >
      <div class="flex flex-wrap items-start justify-between gap-2">
        <h2 class="m-0 min-w-0 flex-1 text-base font-semibold break-words tablet:text-lg">
          {{ app.contestName || ('applications.card.no-contest-name' | lang) }}
        </h2>
        <app-status-tag kind="application" [value]="app.status" />
      </div>

      <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-2 text-sm tablet:grid-cols-3">
        <div class="flex flex-col">
          <dt class="text-surface-500">{{ 'applications.fields.registration-number' | lang }}</dt>
          <dd class="m-0 font-medium">{{ app.registrationNumber || '—' }}</dd>
        </div>
        <div class="flex flex-col">
          <dt class="text-surface-500">{{ 'applications.fields.created-at' | lang }}</dt>
          <dd class="m-0">{{ app.createdAt | serverDateTime }}</dd>
        </div>
        <div class="flex flex-col">
          <dt class="text-surface-500">{{ 'applications.fields.updated-at' | lang }}</dt>
          <dd class="m-0">{{ app.updatedAt | serverDateTime }}</dd>
        </div>
      </dl>

      @if (stages().length) {
        <div class="flex flex-wrap gap-2 border-t border-surface-100 pt-3 text-sm">
          @for (stage of stages(); track stage.stage) {
            <span class="inline-flex items-center gap-2 rounded-lg bg-primary-50 px-2.5 py-1 text-primary-800">
              <i class="pi pi-calendar text-xs" aria-hidden="true"></i>
              {{ 'applications.stage.' + stage.stage | lang }}: {{ stage.date | serverDateTime }}
            </span>
          }
        </div>
      }

      <span class="inline-flex items-center gap-1 self-end text-sm font-medium text-primary">
        {{ 'applications.card.open' | lang }}
        <i class="pi pi-angle-right text-xs" aria-hidden="true"></i>
      </span>
    </a>
  `,
})
export class ApplicationCardComponent {
  readonly application = input.required<Schemas['ApplicationResponse']>();

  protected readonly stages = computed(() => stageDates(this.application()));
}
