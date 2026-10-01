import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Select } from 'primeng/select';

import { MeetingsApi } from '@domain/api/meetings.api';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { DecisionsPanelComponent } from './decisions-panel.component';
import type { Meeting } from './meeting-rules';

/**
 * Решения (`/administrative/decisions`): решения выбранного заседания — формирование, подтверждение, подпись,
 * скачивание. Заседание выбирается из недавних (открытые и завершённые).
 */
@Component({
  selector: 'app-decisions-page',
  imports: [FormsModule, LangPipe, Select, PageHeaderComponent, DecisionsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="staff-decisions.page-title" subtitle="staff-decisions.subtitle">
      <p-select
        class="w-full desktop-s:w-[28rem]"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [filter]="true"
        [options]="options()"
        [loading]="loading()"
        [placeholder]="'staff-decisions.select-meeting' | lang"
        [ariaLabel]="'staff-decisions.select-meeting' | lang"
        [ngModel]="meetingId()"
        (ngModelChange)="meetingId.set($event)"
      />
    </app-page-header>

    @if (meetingId(); as id) {
      <app-decisions-panel [meetingId]="id" />
    } @else {
      <section
        class="flex flex-col items-center gap-2 rounded-xl border border-surface-200 bg-surface-0 p-8 text-center"
      >
        <i class="pi pi-file-check text-3xl text-surface-400" aria-hidden="true"></i>
        <p class="m-0 text-surface-600">{{ 'staff-decisions.pick' | lang }}</p>
      </section>
    }
  `,
})
export default class DecisionsPage {
  private readonly api = inject(MeetingsApi);
  private readonly lang = inject(LangService);
  private readonly dateTime = new ServerDateTimePipe();

  protected readonly meetings = signal<Meeting[]>([]);
  protected readonly loading = signal(true);
  protected readonly meetingId = signal<number | null>(null);

  protected readonly options = computed(() => {
    this.lang.currentLang();

    return this.meetings()
      .filter((meeting) => meeting.id !== undefined)
      .map((meeting) => ({
        value: meeting.id as number,
        label: `${meeting.title || `#${meeting.id}`} · ${this.lang.get(`status.meetingType.${meeting.type}`)} · ${this.dateTime.transform(meeting.startDateTime)}`,
      }));
  });

  constructor() {
    this.api
      .byStatus(['OPENED', 'APPROVED', 'DECLINED'], { size: 200, sort: 'startDateTime,desc' })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (result) => {
          this.meetings.set(result.content);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
