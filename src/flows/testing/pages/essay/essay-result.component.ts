import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import { ServerDateTimePipe } from '@shared/lib/format.pipes';

import { EssayWorkStore } from './essay-work.store';

/**
 * Итог: работа принята (`submitted`) или срок вышел без отправки. После этого токен этапа больше ни к чему
 * не допускает — остаётся только выход.
 */
@Component({
  selector: 'app-essay-result',
  imports: [LangPipe, Button, ServerDateTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-xl border border-surface-200 bg-surface-0 p-5 text-center tablet:p-8"
      aria-labelledby="essay-result-title"
    >
      @if (done()) {
        <span
          class="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700"
          aria-hidden="true"
        >
          <i class="pi pi-check text-2xl"></i>
        </span>
        <h1 id="essay-result-title" class="m-0 text-xl font-semibold tablet:text-2xl">
          {{ (auto() ? 'essay.result.auto-title' : 'essay.result.done-title') | lang }}
        </h1>
        @if (store.submission()?.finishedAt; as finishedAt) {
          <p class="m-0 text-sm text-surface-500">
            {{ 'essay.result.finished-at' | lang: { date: (finishedAt | serverDateTime) } }}
          </p>
        }
        <p class="m-0 max-w-xl text-sm leading-relaxed">{{ 'essay.result.done-text' | lang }}</p>
      } @else {
        <span
          class="flex size-14 items-center justify-center rounded-full bg-orange-100 text-orange-700"
          aria-hidden="true"
        >
          <i class="pi pi-clock text-2xl"></i>
        </span>
        <h1 id="essay-result-title" class="m-0 text-xl font-semibold tablet:text-2xl">
          {{ 'essay.result.expired-title' | lang }}
        </h1>
        <p class="m-0 max-w-xl text-sm leading-relaxed">{{ 'essay.result.expired-text' | lang }}</p>
      }

      <p class="m-0 max-w-xl text-sm text-surface-500">{{ 'essay.result.logout-hint' | lang }}</p>

      <p-button
        icon="pi pi-sign-out"
        styleClass="w-full tablet:w-auto"
        class="w-full tablet:w-auto"
        [label]="'essay.result.logout' | lang"
        [loading]="leaving()"
        (onClick)="logout()"
      />
    </section>
  `,
})
export class EssayResultComponent {
  protected readonly store = inject(EssayWorkStore);

  protected readonly leaving = signal(false);
  protected readonly done = computed(() => this.store.phase() === 'done');
  protected readonly auto = computed(() => this.store.finishedBy() === 'auto');

  protected async logout(): Promise<void> {
    this.leaving.set(true);

    try {
      await this.store.logout();
    } finally {
      this.leaving.set(false);
    }
  }
}
