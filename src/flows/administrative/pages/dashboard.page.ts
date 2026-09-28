import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LangPipe } from '@reforgium/presentia';
import { Skeleton } from 'primeng/skeleton';
import { catchError, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { SettingsApi } from '@domain/api/settings.api';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

/** Дашборд сотрудников: метрики `GET /v1/dashboard`, набор зависит от ролей пользователя. */
@Component({
  selector: 'app-dashboard-page',
  imports: [LangPipe, Skeleton, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="shell.nav.dashboard" />

    <div class="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop-s:grid-cols-4">
      @if (metrics(); as items) {
        @for (metric of items; track metric.type) {
          <div class="rounded-xl border border-surface-200 bg-surface-0 p-5">
            <div class="text-sm text-surface-500">{{ 'shell.metrics.' + metric.type | lang }}</div>
            <div class="mt-2 text-3xl font-semibold text-primary-800">{{ metric.value ?? 0 }}</div>
          </div>
        } @empty {
          <p class="m-0 text-surface-500">{{ 'shell.table.empty' | lang }}</p>
        }
      } @else {
        @for (tile of [1, 2, 3, 4]; track tile) {
          <p-skeleton height="6.5rem" borderRadius="0.75rem" />
        }
      }
    </div>
  `,
})
export default class DashboardPage {
  protected readonly metrics = toSignal<Schemas['MetricValue'][] | null>(
    inject(SettingsApi)
      .dashboard()
      .pipe(catchError(() => of([]))),
    { initialValue: null },
  );
}
