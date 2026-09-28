import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';

import type { Schemas } from '@domain/api/api.types';
import type { DraftFormValue } from '@features/application-draft/draft-form';
import { type ReviewCheck, reviewChecks, sendBlocked } from '@features/application-draft/review-checks';
import { LocalDatePipe } from '@shared/lib/format.pipes';

/** Шаг 5: сводка по заявке, проверки перед отправкой и кнопка «Отправить на проверку». */
@Component({
  selector: 'app-review-step',
  imports: [LangPipe, Button, Message, LocalDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5">
      <section class="flex flex-col gap-2">
        <h3 class="m-0 text-base font-semibold">{{ 'wizard.review.contest' | lang }}</h3>
        <dl class="m-0 grid grid-cols-1 gap-x-4 gap-y-2 text-sm tablet:grid-cols-[12rem_1fr]">
          <dt class="text-surface-500">{{ 'wizard.review.contest-name' | lang }}</dt>
          <dd class="m-0">{{ contest()?.name || application().contestName || '—' }}</dd>
          @if (contest()?.documentAcceptanceEndDate; as deadline) {
            <dt class="text-surface-500">{{ 'wizard.review.deadline' | lang }}</dt>
            <dd class="m-0">{{ deadline | localDate }}</dd>
          }
        </dl>
      </section>

      <section class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <h3 class="m-0 flex-1 text-base font-semibold">{{ 'wizard.steps.contacts' | lang }}</h3>
          <p-button size="small" [text]="true" [label]="'shell.actions.edit' | lang" (onClick)="edit.emit(1)" />
        </div>
        <dl class="m-0 grid grid-cols-1 gap-x-4 gap-y-2 text-sm tablet:grid-cols-[12rem_1fr]">
          @for (row of contactRows(); track row.key) {
            <dt class="text-surface-500">{{ 'wizard.contacts.' + row.key | lang }}</dt>
            <dd class="m-0 whitespace-pre-line break-words">
              @if (!row.value) {
                —
              } @else if (row.i18n) {
                {{ 'wizard.language.' + row.value | lang }}
              } @else {
                {{ row.value }}
              }
            </dd>
          }
        </dl>
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="m-0 text-base font-semibold">{{ 'wizard.review.checks' | lang }}</h3>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (check of checks(); track check.key) {
            <li class="flex flex-wrap items-center gap-3 rounded-lg border border-surface-200 px-3 py-2.5">
              <i class="pi shrink-0" [class]="icon(check)"></i>
              <span class="min-w-0 flex-1 text-sm">
                {{ 'wizard.review.check.' + check.key + '.' + check.state | lang: { count: check.count } }}
              </span>
              @if (check.state !== 'ok') {
                <p-button
                  size="small"
                  [text]="true"
                  [label]="'wizard.review.fix' | lang"
                  (onClick)="edit.emit(check.step)"
                />
              }
            </li>
          }
        </ul>
      </section>

      @if (blocked()) {
        <p-message severity="error" [text]="'wizard.review.blocked' | lang" />
      } @else {
        <p-message severity="info" [text]="'wizard.review.after-send' | lang" />
      }

      <div class="flex justify-end">
        <p-button
          icon="pi pi-send"
          [label]="(resubmit() ? 'wizard.review.resend' : 'wizard.review.send') | lang"
          [disabled]="blocked()"
          [loading]="sending()"
          (onClick)="send.emit()"
        />
      </div>
    </div>
  `,
})
export class ReviewStepComponent {
  readonly application = input.required<Schemas['ApplicationResponse']>();
  readonly contest = input<Schemas['ContestResponse'] | null>(null);
  readonly contacts = input.required<DraftFormValue>();
  readonly contactsValid = input(true);
  readonly dossierComplete = input(false);
  readonly missingDocuments = input(0);
  readonly unanswered = input(0);
  readonly sending = input(false);

  readonly edit = output<number>();
  readonly send = output<void>();

  protected readonly resubmit = computed(() => this.application().status === 'RETURNED_FOR_CORRECTION');

  protected readonly contactRows = computed(() => {
    const value = this.contacts();

    return [
      { key: 'language', value: value.preferredLanguage ?? '', i18n: true },
      { key: 'email', value: value.email, i18n: false },
      { key: 'home-phone', value: value.homePhone, i18n: false },
      { key: 'work-phone', value: value.workPhone, i18n: false },
      { key: 'home-address', value: value.homeAddress, i18n: false },
      { key: 'contact-info', value: value.contactInfo, i18n: false },
    ];
  });

  protected readonly checks = computed(() =>
    reviewChecks({
      contactsValid: this.contactsValid(),
      dossierComplete: this.dossierComplete(),
      missingDocuments: this.missingDocuments(),
      unanswered: this.unanswered(),
    }),
  );

  protected readonly blocked = computed(() => sendBlocked(this.checks()));

  protected icon(check: ReviewCheck): string {
    if (check.state === 'ok') return 'pi pi-check-circle text-green-600';

    return check.state === 'error' ? 'pi pi-times-circle text-red-600' : 'pi pi-exclamation-triangle text-orange-500';
  }
}
