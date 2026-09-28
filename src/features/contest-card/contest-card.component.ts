import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import type { Schemas } from '@domain/api/api.types';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import type { ContestAction } from './contest-action';
import { ContestActionButtonComponent } from './contest-action-button.component';
import { ContestProfileHintComponent } from './profile-hint.component';

/** Карточка конкурса из `GET /v1/contest/available`: сроки приёма, места, статус участия и действие. */
@Component({
  selector: 'app-contest-card',
  imports: [
    RouterLink,
    LangPipe,
    Button,
    LocalDatePipe,
    StatusTagComponent,
    ContestActionButtonComponent,
    ContestProfileHintComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    @let item = contest();
    <article class="flex h-full flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <div class="flex flex-wrap items-center gap-2">
        <app-status-tag kind="contestType" [value]="item.type" />
        <app-status-tag kind="visible" [value]="item.visibleStatus" />
      </div>

      <a
        class="line-clamp-3 break-words text-lg font-semibold text-surface-900 no-underline hover:text-primary"
        [routerLink]="['/cabinet/contests', item.id]"
      >
        {{ item.name }}
      </a>

      <dl class="m-0 flex flex-col gap-2 text-sm">
        <div class="flex items-start justify-between gap-3">
          <dt class="text-surface-500">{{ 'contests.card.start' | lang }}</dt>
          <dd class="m-0 shrink-0 font-medium">{{ item.startDate | localDate }}</dd>
        </div>
        <div class="flex items-start justify-between gap-3">
          <dt class="text-surface-500">{{ 'contests.card.end' | lang }}</dt>
          <dd class="m-0 shrink-0 font-medium">{{ item.documentAcceptanceEndDate | localDate }}</dd>
        </div>
        <div class="flex items-start justify-between gap-3">
          <dt class="text-surface-500">{{ 'contests.card.vacant-places' | lang }}</dt>
          <dd class="m-0 shrink-0 font-medium">{{ item.vacantPlaces ?? '—' }}</dd>
        </div>
      </dl>

      @if (profileHint()) {
        <app-contest-profile-hint />
      }

      <!-- Кнопки друг под другом: подписи причин («Приём документов завершён») не помещаются в половину карточки. -->
      <div class="mt-auto flex flex-col gap-2 pt-1">
        <app-contest-action-button
          [action]="action()"
          [applicationId]="applicationId()"
          [loading]="loading()"
          [disabled]="disabled()"
          (apply)="apply.emit()"
        />
        <p-button
          icon="pi pi-info-circle"
          severity="secondary"
          styleClass="w-full"
          [text]="true"
          [label]="'contests.card.details' | lang"
          [routerLink]="['/cabinet/contests', item.id]"
        />
      </div>
    </article>
  `,
})
export class ContestCardComponent {
  readonly contest = input.required<Schemas['ContestCardResponse']>();
  readonly action = input.required<ContestAction>();
  readonly applicationId = input<number | null | undefined>(null);
  readonly loading = input(false);
  readonly disabled = input(false);
  /** Показать подсказку «заполните личное дело» (отказ 4137). */
  readonly profileHint = input(false);
  readonly apply = output();
}
