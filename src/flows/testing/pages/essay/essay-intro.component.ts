import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import { formatCountdown } from '@features/stage-timer/stage-timer.logic';
import { SessionService } from '@shared/auth/session.service';

import { AUTO_SUBMIT_SECONDS } from './essay.logic';
import { EssayWorkStore } from './essay-work.store';

/**
 * Вводная: правила и время. Отсчёт идёт с момента входа по коду (бэкенд фиксирует `startedAt` при проверке кода),
 * поэтому показываем остаток, а тему — после «Приступить».
 */
@Component({
  selector: 'app-essay-intro',
  imports: [LangPipe, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-6"
      aria-labelledby="essay-intro-title"
    >
      <h1 id="essay-intro-title" class="m-0 text-xl font-semibold tablet:text-2xl">{{ 'essay.intro.title' | lang }}</h1>

      @if (fullName()) {
        <p class="m-0 font-semibold">{{ 'essay.intro.dear' | lang: { name: fullName() } }}</p>
      }

      <p class="m-0 text-sm leading-relaxed">{{ 'essay.intro.text' | lang }}</p>

      <dl class="m-0 grid grid-cols-1 gap-3 tablet:grid-cols-3">
        @if (store.timeLimitMinutes(); as minutes) {
          <div class="rounded-lg bg-surface-50 p-3">
            <dt class="text-xs text-surface-500">{{ 'essay.intro.limit' | lang }}</dt>
            <dd class="m-0 mt-1 text-lg font-semibold">{{ 'essay.intro.minutes' | lang: { minutes } }}</dd>
          </div>
        }
        <div class="rounded-lg bg-surface-50 p-3">
          <dt class="text-xs text-surface-500">{{ 'essay.intro.left' | lang }}</dt>
          <dd class="m-0 mt-1 text-lg font-semibold tabular-nums">{{ left() }}</dd>
        </div>
        <div class="rounded-lg bg-surface-50 p-3">
          <dt class="text-xs text-surface-500">{{ 'essay.intro.questions' | lang }}</dt>
          <dd class="m-0 mt-1 text-lg font-semibold">{{ store.questions().length }}</dd>
        </div>
      </dl>

      <div class="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-800">
        <i class="pi pi-clock mr-1" aria-hidden="true"></i>{{ 'essay.intro.running' | lang }}
      </div>

      <h2 class="m-0 text-base font-semibold">{{ 'essay.intro.rules-title' | lang }}</h2>
      <ul class="m-0 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
        @for (rule of rules; track rule) {
          <li>{{ 'essay.intro.rules.' + rule | lang: { seconds: autoSubmitSeconds } }}</li>
        }
      </ul>

      <p class="m-0 text-sm text-surface-600">{{ 'essay.intro.warning' | lang }}</p>

      <div class="flex">
        <p-button
          styleClass="w-full tablet:w-auto"
          icon="pi pi-pencil"
          [label]="'essay.intro.start' | lang"
          (onClick)="store.start()"
        />
      </div>
    </section>
  `,
})
export class EssayIntroComponent {
  protected readonly store = inject(EssayWorkStore);
  private readonly session = inject(SessionService);

  protected readonly rules = ['answers', 'once', 'auto', 'draft', 'paste'] as const;
  protected readonly autoSubmitSeconds = AUTO_SUBMIT_SECONDS;
  protected readonly fullName = computed(() => this.session.user()?.fullName ?? '');
  protected readonly left = computed(() => formatCountdown(this.store.remaining()));
}
