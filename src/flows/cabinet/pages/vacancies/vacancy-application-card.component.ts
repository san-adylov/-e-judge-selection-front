import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';

import type { Schemas } from '@domain/api/api.types';
import { FileLinkComponent } from '@features/files/file-link.component';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import {
  applicationActions,
  isAutoAppointed,
  isOfferExpired,
  type VacancyApplication,
  withdrawKind,
} from './vacancy-rules';

/** Отклик или предложение по вакансии: статус, срок ответа, представление (сунуш) и действия кандидата. */
@Component({
  selector: 'app-vacancy-application-card',
  imports: [LangPipe, Button, Message, FileLinkComponent, ServerDateTimePipe, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = application();
    <article class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <header class="flex flex-wrap items-start gap-2">
        <div class="min-w-0 flex-1">
          <h3 class="m-0 text-lg font-semibold break-words">
            {{ vacancyName() || ('vacancies.application.title' | lang: { id: item.vacancyId ?? '—' }) }}
          </h3>
          @if (contest()?.name) {
            <p class="m-0 mt-1 text-sm text-surface-500">{{ contest()!.name }}</p>
          }
        </div>
        <app-status-tag kind="vacancyApplication" [value]="item.status" />
      </header>

      <p class="m-0 text-sm text-surface-700">{{ 'vacancies.origin.' + origin() | lang }}</p>

      @if (item.status === 'DRAFT') {
        <p-message
          [severity]="expired() ? 'error' : 'warn'"
          [text]="
            (expired()
              ? 'vacancies.offer.expired'
              : item.responseDeadline
                ? 'vacancies.offer.pending'
                : 'vacancies.offer.pending-no-deadline'
            ) | lang: { deadline: item.responseDeadline | serverDateTime }
          "
        />
      }

      <dl class="m-0 grid grid-cols-1 gap-3 text-sm tablet:grid-cols-2">
        @if (contest()?.courtInstanceName) {
          <div>
            <dt class="text-surface-500">{{ 'vacancies.field.court' | lang }}</dt>
            <dd class="m-0 mt-0.5">{{ contest()!.courtInstanceName }}</dd>
          </div>
        }
        @if (item.responseDeadline) {
          <div>
            <dt class="text-surface-500">{{ 'vacancies.field.response-deadline' | lang }}</dt>
            <dd class="m-0 mt-0.5">{{ item.responseDeadline | serverDateTime }}</dd>
          </div>
        }
        @if (item.selectedBySystem && item.createdAt) {
          <div>
            <dt class="text-surface-500">{{ 'vacancies.field.offered-at' | lang }}</dt>
            <dd class="m-0 mt-0.5">{{ item.createdAt | serverDateTime }}</dd>
          </div>
        }
        @if (item.submittedAt) {
          <div>
            <dt class="text-surface-500">{{ 'vacancies.field.submitted-at' | lang }}</dt>
            <dd class="m-0 mt-0.5">{{ item.submittedAt | serverDateTime }}</dd>
          </div>
        }
        @if (item.sunushFileId) {
          <div>
            <dt class="text-surface-500">{{ 'vacancies.field.sunush' | lang }}</dt>
            <dd class="m-0 mt-0.5 flex flex-col gap-1">
              <app-file-link [fileId]="item.sunushFileId" />
              <span class="text-xs text-surface-500">
                {{ (item.sunushConfirmed ? 'vacancies.sunush.confirmed' : 'vacancies.sunush.pending') | lang }}
              </span>
            </dd>
          </div>
        }
      </dl>

      @if (actions().confirm || actions().withdraw) {
        <footer class="flex flex-wrap items-center gap-3 border-t border-surface-100 pt-4">
          @if (actions().confirm) {
            <p-button
              icon="pi pi-check"
              [label]="'vacancies.action.confirm' | lang"
              [loading]="busy()"
              (onClick)="confirm.emit()"
            />
          }
          @if (actions().withdraw) {
            <p-button
              icon="pi pi-times"
              severity="danger"
              [outlined]="true"
              [label]="'vacancies.action.' + kind() | lang"
              [disabled]="busy()"
              (onClick)="withdraw.emit()"
            />
          }
        </footer>
      }
    </article>
  `,
})
export class VacancyApplicationCardComponent {
  readonly application = input.required<VacancyApplication>();
  readonly contest = input<Schemas['ContestResponse'] | undefined>(undefined);
  /** Название, если вакансия есть в списке доступных; иначе — номер вакансии. */
  readonly vacancyName = input<string | undefined>(undefined);
  readonly busy = input(false);

  readonly confirm = output();
  readonly withdraw = output();

  protected readonly actions = computed(() => applicationActions(this.application()));
  protected readonly expired = computed(() => isOfferExpired(this.application()));
  protected readonly kind = computed(() => withdrawKind(this.application()));
  protected readonly origin = computed(() => {
    const application = this.application();

    if (!application.selectedBySystem) return 'candidate';

    return isAutoAppointed(application) ? 'auto-appointed' : 'offer';
  });
}
