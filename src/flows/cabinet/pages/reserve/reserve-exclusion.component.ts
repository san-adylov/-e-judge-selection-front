import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import { DirectoryStore } from '@domain/stores/directory.store';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';

import type { Reserve } from './reserve.logic';

/** Сведения об исключении из резерва; справочник причин грузится только для исключённых позиций. */
@Component({
  selector: 'app-reserve-exclusion',
  imports: [LangPipe, ServerDateTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <p class="m-0 font-semibold">{{ 'reserve.exclusion.title' | lang }}</p>
      <dl class="m-0 mt-2 grid gap-2">
        <div>
          <dt class="text-xs text-red-700">{{ 'reserve.exclusion.date' | lang }}</dt>
          <dd class="m-0">{{ reserve().excludedAt | serverDateTime }}</dd>
        </div>
        @if (reasons().length) {
          <div>
            <dt class="text-xs text-red-700">{{ 'reserve.exclusion.reasons' | lang }}</dt>
            <dd class="m-0">
              <ul class="m-0 list-disc pl-5">
                @for (reason of reasons(); track reason) {
                  <li>{{ reason }}</li>
                }
              </ul>
            </dd>
          </div>
        }
        @if (reserve().exclusionComment) {
          <div>
            <dt class="text-xs text-red-700">{{ 'reserve.exclusion.comment' | lang }}</dt>
            <dd class="m-0 whitespace-pre-line">{{ reserve().exclusionComment }}</dd>
          </div>
        }
      </dl>
    </div>
  `,
})
export class ReserveExclusionComponent {
  readonly reserve = input.required<Reserve>();

  private readonly options = inject(DirectoryStore).options('EXCLUSION_REASON');

  protected readonly reasons = computed(() => {
    const ids = new Set(this.reserve().exclusionReasonIds ?? []);

    return this.options()
      .filter((option) => ids.has(option.value))
      .map((option) => option.label);
  });
}
