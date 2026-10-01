import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { switchMap } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ComplaintsApi } from '@domain/api/complaints.api';
import { MeetingsApi } from '@domain/api/meetings.api';
import { toServerDateTime } from '@shared/lib/dates';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';

type Complaint = Schemas['ComplaintResponse'];
type Meeting = Schemas['MeetingResponse'];
type Mode = 'existing' | 'new';

/**
 * Передача жалобы на рассмотрение Совета: к уже назначенному заседанию по жалобам (`POST /complaint-reviews`)
 * или с назначением нового заседания `COMPLAINT_REVIEW` (`POST /meeting` с `contestId` и `complaintId`, затем прикрепление).
 */
@Component({
  selector: 'app-complaint-review-dialog',
  imports: [FormsModule, LangPipe, Button, DatePicker, Dialog, Message, Select, SelectButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-lg mx-4"
      [modal]="true"
      [header]="'staff-complaints.review.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <div class="flex flex-col gap-4">
        <p-selectbutton
          optionLabel="label"
          optionValue="value"
          [options]="modeOptions()"
          [allowEmpty]="false"
          [ngModel]="mode()"
          (ngModelChange)="mode.set($event)"
        />

        @if (mode() === 'existing') {
          @if (!meetings().length) {
            <p-message severity="info" icon="pi pi-info-circle" [text]="'staff-complaints.review.no-meetings' | lang" />
          } @else {
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium" for="review-meeting">{{
                'staff-complaints.review.meeting' | lang
              }}</label>
              <p-select
                inputId="review-meeting"
                optionLabel="label"
                optionValue="value"
                appendTo="body"
                styleClass="w-full"
                [options]="meetingOptions()"
                [placeholder]="'shell.form.select' | lang"
                [ngModel]="meetingId()"
                (ngModelChange)="meetingId.set($event)"
              />
            </div>
          }
        } @else {
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium" for="review-start">{{ 'staff-meetings.schedule.start' | lang }}</label>
            <p-datepicker
              inputId="review-start"
              dateFormat="dd.mm.yy"
              appendTo="body"
              styleClass="w-full"
              [showTime]="true"
              [showIcon]="true"
              [minDate]="now"
              [ngModel]="start()"
              (ngModelChange)="start.set($event)"
            />
          </div>
        }

        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            icon="pi pi-calendar-plus"
            [label]="'staff-complaints.review.submit' | lang"
            [loading]="saving()"
            [disabled]="!valid()"
            (onClick)="submit()"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class ComplaintReviewDialogComponent {
  private readonly api = inject(ComplaintsApi);
  private readonly meetingsApi = inject(MeetingsApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly dateTime = new ServerDateTimePipe();

  readonly visible = model(false);
  readonly complaint = input<Complaint | null>(null);
  /** Конкурс жалобы нужен заседанию (`requiresContest`). */
  readonly contestId = input<number | null>(null);
  readonly attached = output<Complaint>();

  protected readonly now = new Date();
  protected readonly mode = signal<Mode>('existing');
  protected readonly meetings = signal<Meeting[]>([]);
  protected readonly meetingId = signal<number | null>(null);
  protected readonly start = signal<Date | null>(null);
  protected readonly saving = signal(false);

  protected readonly modeOptions = computed(() => {
    this.lang.currentLang();

    return (['existing', 'new'] as const).map((value) => ({
      value,
      label: this.lang.get(`staff-complaints.review.mode.${value}`),
    }));
  });
  protected readonly meetingOptions = computed(() =>
    this.meetings()
      .filter((meeting) => meeting.id !== undefined)
      .map((meeting) => ({
        value: meeting.id as number,
        label: `${meeting.title || `#${meeting.id}`} · ${this.dateTime.transform(meeting.startDateTime)}`,
      })),
  );
  protected readonly valid = computed(() =>
    this.mode() === 'existing' ? this.meetingId() !== null : this.start() !== null && this.contestId() !== null,
  );

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.open());
    });
  }

  protected submit(): void {
    const complaintId = this.complaint()?.id;
    const contestId = this.contestId();

    if (complaintId === undefined || !this.valid()) return;

    const attach = (meetingId: number) => this.api.attachToMeeting({ meetingId, complaintId });
    const request =
      this.mode() === 'existing'
        ? attach(this.meetingId()!)
        : this.meetingsApi
            .schedule({
              type: 'COMPLAINT_REVIEW',
              startDateTime: toServerDateTime(this.start()!),
              contestId: contestId ?? undefined,
              complaintId,
            })
            .pipe(switchMap((meeting) => attach(meeting.id ?? 0)));

    this.saving.set(true);
    request.subscribe({
      next: (complaint) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('staff-complaints.review.success'));
        this.visible.set(false);
        this.attached.emit(complaint);
      },
      error: () => this.saving.set(false),
    });
  }

  private open(): void {
    this.meetingId.set(null);
    this.start.set(null);
    this.meetingsApi.byStatus(['APPOINTED', 'OPENED'], { size: 100, sort: 'startDateTime,desc' }).subscribe({
      next: (result) => {
        const reviews = result.content.filter((meeting) => meeting.type === 'COMPLAINT_REVIEW');

        this.meetings.set(reviews);
        this.mode.set(reviews.length ? 'existing' : 'new');
      },
      error: () => this.meetings.set([]),
    });
  }
}
