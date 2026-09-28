import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Tag } from 'primeng/tag';

import { PageHeaderComponent } from './page-header.component';

/**
 * Экран, который ещё не перенесён из v1. Заголовок — `title` маршрута, остальное — `data` (`withComponentInputBinding`):
 * кто видит экран, кто выполняет действия и какие маршруты API v2 он вызывает.
 */
@Component({
  selector: 'app-page-placeholder',
  imports: [LangPipe, Tag, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="pageTitle" subtitle="shell.placeholder.subtitle" />

    <section class="max-w-4xl rounded-xl border border-surface-200 bg-surface-0 p-5 tablet:p-6">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-surface-500">{{ 'shell.placeholder.access' | lang }}:</span>
        <p-tag severity="info" [value]="access()" />
        @if (actions()) {
          <span class="text-sm text-surface-600">{{ actions() }}</span>
        }
      </div>

      @if (api().length) {
        <h2 class="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-surface-500">
          {{ 'shell.placeholder.api' | lang }}
        </h2>
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          @for (endpoint of api(); track endpoint) {
            <li>
              <code class="rounded bg-surface-100 px-2 py-0.5 text-sm">{{ endpoint }}</code>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class PagePlaceholderComponent {
  protected readonly pageTitle = inject(ActivatedRoute).snapshot.title ?? 'shell.placeholder.title';

  /** Группа доступа, которая видит экран. */
  readonly access = input('');
  /** Кто выполняет действия, если это не вся группа. */
  readonly actions = input('');
  /** Маршруты API v2 от префикса `/v1`. */
  readonly api = input<string[]>([]);
}
