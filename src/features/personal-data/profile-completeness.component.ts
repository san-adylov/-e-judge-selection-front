import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';

import type { Completeness } from './profile-completeness';

/**
 * Сводка обязательных разделов для подачи заявки: личные данные с файлом, образование, трудовая деятельность.
 * Пункт ведёт к разделу на странице: якорь `#section-<SECTION>`.
 */
@Component({
  selector: 'app-profile-completeness',
  imports: [LangPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="rounded-xl border bg-surface-0 p-4 tablet:p-5"
      [class.border-surface-200]="summary().complete || summary().loading"
      [class.border-orange-300]="!summary().complete && !summary().loading"
    >
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="m-0 flex-1 text-base font-semibold">{{ 'personal.completeness.title' | lang }}</h2>
        @if (!summary().loading) {
          <span
            class="text-sm font-medium"
            [class.text-green-700]="summary().complete"
            [class.text-orange-700]="!summary().complete"
          >
            {{ (summary().complete ? 'personal.completeness.ready' : 'personal.completeness.not-ready') | lang }}
          </span>
        }
      </div>

      <ul class="m-0 mt-3 flex list-none flex-col gap-2 p-0 tablet:flex-row tablet:flex-wrap tablet:gap-x-6">
        @for (item of summary().items; track item.section) {
          <li>
            <a
              class="inline-flex items-center gap-2 text-sm text-surface-700 no-underline hover:underline"
              [routerLink]="[]"
              [fragment]="'section-' + item.section"
            >
              @switch (item.state) {
                @case ('loading') {
                  <i class="pi pi-spin pi-spinner text-surface-400"></i>
                }
                @case ('done') {
                  <i class="pi pi-check-circle text-green-600"></i>
                }
                @default {
                  <i class="pi pi-times-circle text-red-600"></i>
                }
              }
              <span class="sr-only">{{ 'personal.completeness.state.' + item.state | lang }}</span>
              <span>{{ 'profile.section.' + item.section | lang }}</span>
              @if (item.state === 'no-file') {
                <span class="text-red-600">({{ 'personal.completeness.no-file' | lang }})</span>
              }
            </a>
          </li>
        }
      </ul>
    </section>
  `,
})
export class ProfileCompletenessComponent {
  readonly summary = input.required<Completeness>();
}
