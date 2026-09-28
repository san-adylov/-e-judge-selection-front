import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import { LocalDatePipe, ServerDateTimePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import type { ReserveCard } from './reserve.logic';
import { ReserveExclusionComponent } from './reserve-exclusion.component';

/** Карточка позиции в резерве: конкурс, баллы, срок, связанная вакансия и действия кандидата. */
@Component({
  selector: 'app-reserve-card',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    LangPipe,
    Button,
    LocalDatePipe,
    ServerDateTimePipe,
    StatusTagComponent,
    ReserveExclusionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = card();
    @let reserve = item.reserve;

    <article class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <header class="flex flex-wrap items-start gap-3">
        <div class="min-w-0 flex-1">
          <h2 class="m-0 text-lg font-semibold break-words">
            {{ item.contestName ?? ('reserve.card.contest-fallback' | lang: { id: reserve.contestId }) }}
          </h2>
          @if (item.contestType) {
            <p class="m-0 mt-1 text-sm text-surface-500">{{ 'status.contestType.' + item.contestType | lang }}</p>
          }
        </div>
        <app-status-tag kind="reserve" [value]="reserve.status" />
      </header>

      <dl class="m-0 mt-4 grid grid-cols-2 gap-4 tablet:grid-cols-4">
        <div>
          <dt class="text-xs text-surface-500">{{ 'reserve.card.rank' | lang }}</dt>
          <dd class="m-0 mt-1 font-semibold">{{ item.rank ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-surface-500">{{ 'reserve.card.score' | lang }}</dt>
          <dd class="m-0 mt-1 font-semibold">{{ reserve.totalScore ?? 0 | number: '1.0-2' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-surface-500">{{ 'reserve.card.added' | lang }}</dt>
          <dd class="m-0 mt-1">{{ (reserve.createdAt | date: 'dd.MM.yyyy' : '+0600') ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-surface-500">{{ 'reserve.card.expires' | lang }}</dt>
          <dd
            class="m-0 mt-1"
            [class.font-semibold]="item.expiry.tone !== 'plain'"
            [class.text-orange-600]="item.expiry.tone === 'soon'"
            [class.text-red-600]="item.expiry.tone === 'expired'"
          >
            {{ reserve.expiresAt | localDate }}
            @if (item.expiry.tone === 'soon') {
              <span class="mt-0.5 flex items-center gap-1 text-xs">
                <i class="pi pi-exclamation-triangle text-xs"></i>
                {{ 'reserve.card.days-left' | lang: { days: item.expiry.daysLeft ?? 0 } }}
              </span>
            } @else if (item.expiry.tone === 'expired') {
              <span class="mt-0.5 flex items-center gap-1 text-xs">
                <i class="pi pi-times-circle text-xs"></i>
                {{ 'reserve.card.expired' | lang }}
              </span>
            }
          </dd>
        </div>
      </dl>

      <p class="m-0 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-surface-500">
        @for (part of breakdown(); track part.key) {
          <span>{{ part.key | lang }}: {{ part.value ?? 0 | number: '1.0-2' }}</span>
        }
      </p>

      @if (reserve.passed === false) {
        <p class="m-0 mt-3 text-sm text-orange-700">{{ 'reserve.card.not-passed' | lang }}</p>
      }

      @if (hint(); as key) {
        <p class="m-0 mt-3 text-sm text-surface-700">{{ key | lang }}</p>
      }
      @if (reserve.status === 'CONFIRMED' && reserve.confirmedAt) {
        <p class="m-0 mt-3 text-sm text-surface-700">
          {{ 'reserve.card.confirmed-at' | lang: { date: (reserve.confirmedAt | serverDateTime) } }}
        </p>
      }

      @if (item.offer; as offer) {
        <div class="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-primary-50 p-3 text-sm">
          <div class="min-w-0 flex-1">
            <p class="m-0 text-xs text-primary-800">{{ 'reserve.offer.title' | lang }}</p>
            <p class="m-0 mt-0.5 font-semibold text-primary-800 break-words">
              {{ item.offerVacancyName ?? ('reserve.offer.vacancy-fallback' | lang: { id: offer.vacancyId }) }}
            </p>
            @if (offer.status === 'DRAFT' && offer.responseDeadline) {
              <p class="m-0 mt-1 text-primary-800">
                {{ 'reserve.offer.deadline' | lang: { date: (offer.responseDeadline | serverDateTime) } }}
              </p>
            } @else if (offer.selectedBySystem) {
              <p class="m-0 mt-1 text-primary-800">{{ 'reserve.offer.selected-by-system' | lang }}</p>
            }
          </div>
          <app-status-tag kind="vacancyApplication" [value]="offer.status" />
          <a routerLink="/cabinet/vacancies" class="font-medium text-primary hover:underline">
            {{ 'reserve.actions.vacancies' | lang }}
          </a>
        </div>
      } @else if (item.availableVacancies > 0) {
        <div class="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-primary-50 p-3 text-sm">
          <span class="min-w-0 flex-1 text-primary-800">
            {{ 'reserve.available' | lang: { count: item.availableVacancies } }}
          </span>
          <a routerLink="/cabinet/vacancies" class="font-medium text-primary hover:underline">
            {{ 'reserve.actions.vacancies' | lang }}
          </a>
        </div>
      }

      @if (reserve.status === 'EXCLUDED') {
        <app-reserve-exclusion [reserve]="reserve" />
      }

      @if (item.actions.confirm || item.actions.decline) {
        <div class="mt-4 flex flex-wrap justify-end gap-2 border-t border-surface-100 pt-4">
          @if (item.actions.decline) {
            <p-button
              icon="pi pi-times"
              severity="danger"
              [outlined]="true"
              [label]="'reserve.actions.decline' | lang"
              [disabled]="busy()"
              (onClick)="decline.emit()"
            />
          }
          @if (item.actions.confirm) {
            <p-button
              icon="pi pi-check"
              [label]="'reserve.actions.confirm' | lang"
              [loading]="busy()"
              (onClick)="confirm.emit()"
            />
          }
        </div>
      }
    </article>
  `,
})
export class ReserveCardComponent {
  readonly card = input.required<ReserveCard>();
  /** Идёт запрос по этой позиции. */
  readonly busy = input(false);

  readonly confirm = output();
  readonly decline = output();

  protected readonly breakdown = computed(() => {
    const reserve = this.card().reserve;

    return [
      { key: 'reserve.card.breakdown.documents', value: reserve.documentScore },
      { key: 'reserve.card.breakdown.test', value: reserve.testScore },
      { key: 'reserve.card.breakdown.essay', value: reserve.essayScore },
      { key: 'reserve.card.breakdown.interview', value: reserve.interviewScore },
    ];
  });

  /** Пояснение к статусу, требующему внимания кандидата. */
  protected readonly hint = computed(() => {
    switch (this.card().reserve.status) {
      case 'SUBMITTED':
        return 'reserve.card.submitted-hint';
      case 'APPROVED':
        return 'reserve.card.approved-hint';
      case 'APPOINTED':
        return 'reserve.card.appointed-hint';
      default:
        return null;
    }
  });
}
