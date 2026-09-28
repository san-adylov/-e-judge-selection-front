import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import type { Schemas } from '@domain/api/api.types';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { freePlaces, type Reserve, type Vacancy, type VacancyAction } from './vacancy-rules';

/** Карточка доступной вакансии: суд, должность, сроки приёма, места, срок резерва и действие кандидата. */
@Component({
  selector: 'app-vacancy-card',
  imports: [LangPipe, Button, LocalDatePipe, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <header class="flex flex-wrap items-start gap-2">
        <div class="min-w-0 flex-1">
          <h3 class="m-0 text-lg font-semibold break-words">{{ vacancy().name }}</h3>
          @if (contest()?.name) {
            <p class="m-0 mt-1 text-sm text-surface-500">{{ contest()!.name }}</p>
          }
        </div>
        <app-status-tag kind="vacancy" [value]="vacancy().status" />
      </header>

      <dl class="m-0 grid grid-cols-1 gap-3 text-sm tablet:grid-cols-2">
        @if (contest()?.courtInstanceName) {
          <div>
            <dt class="text-surface-500">{{ 'vacancies.field.court' | lang }}</dt>
            <dd class="m-0 mt-0.5">{{ contest()!.courtInstanceName }}</dd>
          </div>
        }
        <div>
          <dt class="text-surface-500">{{ 'vacancies.field.acceptance' | lang }}</dt>
          <dd class="m-0 mt-0.5">{{ vacancy().startDate | localDate }} — {{ vacancy().endDate | localDate }}</dd>
        </div>
        <div>
          <dt class="text-surface-500">{{ 'vacancies.field.places' | lang }}</dt>
          <dd class="m-0 mt-0.5">
            {{ 'vacancies.field.places-value' | lang: { free: free(), total: vacancy().quantity ?? 0 } }}
          </dd>
        </div>
        @if (reserve()?.expiresAt) {
          <div>
            <dt class="text-surface-500">{{ 'vacancies.field.reserve-expires' | lang }}</dt>
            <dd class="m-0 mt-0.5">{{ reserve()!.expiresAt | localDate }}</dd>
          </div>
        }
      </dl>

      @if (vacancy().description) {
        <p class="m-0 text-sm whitespace-pre-line text-surface-700">{{ vacancy().description }}</p>
      }

      <footer class="flex flex-wrap items-center gap-3 border-t border-surface-100 pt-4">
        @switch (action()) {
          @case ('APPLY') {
            <p-button
              icon="pi pi-send"
              [label]="'vacancies.action.apply' | lang"
              [loading]="busy()"
              (onClick)="apply.emit()"
            />
            <span class="text-sm text-surface-500">{{ 'vacancies.hint.apply' | lang }}</span>
          }
          @case ('APPLIED') {
            <span class="inline-flex items-center gap-2 text-sm text-primary">
              <i class="pi pi-check-circle"></i>{{ 'vacancies.hint.applied' | lang }}
            </span>
          }
          @case ('OFFERED') {
            <span class="text-sm">{{ 'vacancies.hint.offered' | lang }}</span>
            <p-button
              severity="secondary"
              [outlined]="true"
              [label]="'vacancies.action.to-offer' | lang"
              (onClick)="openOffer.emit()"
            />
          }
          @case ('NOT_STARTED') {
            <span class="text-sm text-surface-500">
              {{ 'vacancies.hint.not-started' | lang: { date: vacancy().startDate | localDate } }}
            </span>
          }
          @case ('ENDED') {
            <span class="text-sm text-surface-500">{{ 'vacancies.hint.ended' | lang }}</span>
          }
          @default {
            <span class="text-sm text-surface-500">{{ 'vacancies.hint.closed' | lang }}</span>
          }
        }
      </footer>
    </article>
  `,
})
export class VacancyCardComponent {
  readonly vacancy = input.required<Vacancy>();
  readonly action = input.required<VacancyAction>();
  readonly contest = input<Schemas['ContestResponse'] | undefined>(undefined);
  readonly reserve = input<Reserve | undefined>(undefined);
  readonly busy = input(false);

  readonly apply = output();
  readonly openOffer = output();

  protected readonly free = computed(() => freePlaces(this.vacancy()));
}
