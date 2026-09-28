import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import type { Schemas } from '@domain/api/api.types';
import { CandidateProfileApi } from '@domain/api/candidate-profile.api';
import { skipErrorToast } from '@shared/api/http-context';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

/**
 * Предупреждение о годовом запрете на подачу заявок (§19 спеки, `GET /v1/candidate/ban-status`).
 * Без запрета ничего не показывает; ошибка запроса не мешает работе с личным делом.
 */
@Component({
  selector: 'app-ban-status-banner',
  imports: [LangPipe, LocalDatePipe, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status()?.banned) {
      <div
        role="alert"
        class="flex gap-3 rounded-xl border border-orange-300 bg-orange-50 p-4 text-orange-900 tablet:p-5"
      >
        <i class="pi pi-ban mt-0.5 text-xl"></i>
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="font-semibold">
            {{ 'personal.ban.title' | lang: { until: until() } }}
          </div>
          <p class="m-0 text-sm">{{ 'personal.ban.text' | lang }}</p>
          @if (entries().length) {
            <ul class="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              @for (entry of entries(); track $index) {
                <li class="flex flex-wrap items-center gap-2">
                  @if (entry.reason) {
                    <app-status-tag kind="application" [value]="entry.reason" />
                  }
                  <span>{{ entry.bannedFrom | localDate }} — {{ entry.bannedUntil | localDate }}</span>
                </li>
              }
            </ul>
          }
        </div>
      </div>
    }
  `,
})
export class BanStatusBannerComponent {
  private readonly api = inject(CandidateProfileApi);

  protected readonly status = signal<Schemas['BanStatusResponse'] | null>(null);
  protected readonly until = computed(() => new LocalDatePipe().transform(this.status()?.bannedUntil));
  protected readonly entries = computed(() => (this.status()?.entries ?? []).filter((entry) => entry.active !== false));

  constructor() {
    this.api
      .banStatus(skipErrorToast())
      .subscribe({ next: (status) => this.status.set(status), error: () => undefined });
  }
}
