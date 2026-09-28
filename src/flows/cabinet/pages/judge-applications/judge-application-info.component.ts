import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import { LocalDatePipe, ServerDateTimePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import type { Contest, JudgeApplication } from './judge-application.model';

interface Row {
  key: string;
  value: string | null | undefined;
  kind?: 'dateTime' | 'language';
}

/** Сведения о конкурсе и данные заявки (только чтение). */
@Component({
  selector: 'app-judge-application-info',
  imports: [LangPipe, LocalDatePipe, ServerDateTimePipe, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <h2 class="m-0 mb-4 text-lg font-semibold">{{ 'judge-applications.sections.contest' | lang }}</h2>
      <dl class="m-0 grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <div class="tablet:col-span-2">
          <dt class="text-sm text-surface-500">{{ 'judge-applications.fields.contest' | lang }}</dt>
          <dd class="m-0 font-medium break-words">{{ contest()?.name || application().contestName || '—' }}</dd>
        </div>
        @if (contest()?.type) {
          <div>
            <dt class="text-sm text-surface-500">{{ 'judge-applications.fields.contest-type' | lang }}</dt>
            <dd class="m-0 mt-1"><app-status-tag kind="contestType" [value]="contest()!.type" /></dd>
          </div>
        }
        @if (contest()?.courtInstanceName) {
          <div>
            <dt class="text-sm text-surface-500">{{ 'judge-applications.fields.court' | lang }}</dt>
            <dd class="m-0 break-words">{{ contest()!.courtInstanceName }}</dd>
          </div>
        }
        @if (contest()?.documentAcceptanceEndDate) {
          <div>
            <dt class="text-sm text-surface-500">{{ 'judge-applications.fields.acceptance-end' | lang }}</dt>
            <dd class="m-0">{{ contest()!.documentAcceptanceEndDate | localDate }}</dd>
          </div>
        }
      </dl>
    </section>

    <section class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <h2 class="m-0 mb-4 text-lg font-semibold">{{ 'judge-applications.sections.data' | lang }}</h2>
      <dl class="m-0 grid grid-cols-1 gap-3 tablet:grid-cols-2">
        @for (row of rows(); track row.key) {
          <div>
            <dt class="text-sm text-surface-500">{{ 'judge-applications.fields.' + row.key | lang }}</dt>
            <dd class="m-0 break-words whitespace-pre-line">
              @switch (row.kind) {
                @case ('dateTime') {
                  {{ row.value | serverDateTime }}
                }
                @case ('language') {
                  {{ 'judge-applications.languages.' + row.value | lang }}
                }
                @default {
                  {{ row.value }}
                }
              }
            </dd>
          </div>
        }
      </dl>
    </section>
  `,
  host: { class: 'flex flex-col gap-4' },
})
export class JudgeApplicationInfoComponent {
  readonly application = input.required<JudgeApplication>();
  readonly contest = input<Contest | null>(null);
  /** В черновике контакты редактируются формой — здесь только даты и номер. */
  readonly showContacts = input(true);

  protected readonly rows = computed<Row[]>(() => {
    const app = this.application();
    const contacts: Row[] = this.showContacts()
      ? [
          { key: 'language', value: app.preferredLanguage, kind: 'language' },
          { key: 'email', value: app.email },
          { key: 'home-phone', value: app.homePhone },
          { key: 'work-phone', value: app.workPhone },
          { key: 'home-address', value: app.homeAddress },
          { key: 'contact-info', value: app.contactInfo },
        ]
      : [];
    const rows: Row[] = [
      { key: 'registration-number', value: app.registrationNumber },
      { key: 'created-at', value: app.createdAt, kind: 'dateTime' },
      { key: 'submitted-at', value: app.submittedAt, kind: 'dateTime' },
      { key: 'registered-at', value: app.registeredAt, kind: 'dateTime' },
      { key: 'interview-date', value: app.interviewDate, kind: 'dateTime' },
      ...contacts,
    ];

    return rows.filter((row) => !!row.value);
  });
}
