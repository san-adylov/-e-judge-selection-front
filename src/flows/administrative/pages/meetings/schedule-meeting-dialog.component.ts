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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';

import type { MeetingType, Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { MeetingsApi } from '@domain/api/meetings.api';
import { toServerDateTime } from '@shared/lib/dates';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

import { nextStageMeeting } from '../contests/contest-rules';
import { type Meeting } from './meeting-rules';

type Contest = Schemas['ContestResponse'];

/**
 * Назначение заседания этапа конкурса (`POST /meeting`): конкурс → единственный допустимый тип по его статусу
 * (`ContestStateMachine`) → дата и время. Заседания по жалобам, судьям и вакансиям назначаются с их экранов.
 */
@Component({
  selector: 'app-schedule-meeting-dialog',
  imports: [ReactiveFormsModule, LangPipe, Button, DatePicker, Dialog, InputText, Message, Select, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-lg mx-4"
      [modal]="true"
      [header]="'staff-meetings.schedule.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <app-form-field
          label="staff-meetings.schedule.contest"
          inputId="meeting-contest"
          [required]="true"
          [control]="form.controls.contestId"
        >
          <p-select
            inputId="meeting-contest"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            styleClass="w-full"
            [filter]="true"
            [options]="contestOptions()"
            [loading]="contestsLoading()"
            [placeholder]="'shell.form.select' | lang"
            formControlName="contestId"
          />
        </app-form-field>

        @if (stage(); as type) {
          <p-message severity="info" icon="pi pi-calendar-plus">
            {{ 'staff-meetings.schedule.stage' | lang: { type: ('status.meetingType.' + type | lang) } }}
          </p-message>
        } @else if (form.controls.contestId.value !== null) {
          <p-message
            severity="warn"
            icon="pi pi-exclamation-triangle"
            [text]="'staff-meetings.schedule.no-stage' | lang"
          />
        }

        <app-form-field
          label="staff-meetings.schedule.start"
          inputId="meeting-start"
          [required]="true"
          [control]="form.controls.start"
          hint="staff-meetings.schedule.start-hint"
        >
          <p-datepicker
            inputId="meeting-start"
            dateFormat="dd.mm.yy"
            appendTo="body"
            styleClass="w-full"
            [showTime]="true"
            [showIcon]="true"
            [minDate]="now"
            formControlName="start"
          />
        </app-form-field>

        <app-form-field
          label="staff-meetings.schedule.meeting-title"
          inputId="meeting-title"
          [control]="form.controls.title"
        >
          <input pInputText id="meeting-title" class="w-full" [maxlength]="500" formControlName="title" />
        </app-form-field>

        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            type="submit"
            icon="pi pi-calendar-plus"
            [label]="'staff-meetings.schedule.submit' | lang"
            [loading]="saving()"
            [disabled]="!stage()"
          />
        </div>
      </form>
    </p-dialog>
  `,
})
export class ScheduleMeetingDialogComponent {
  private readonly api = inject(MeetingsApi);
  private readonly contestApi = inject(ContestApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  /** Предзаполнение с карточки конкурса (`?contestId=&type=`). */
  readonly contestId = input<number | null>(null);
  readonly scheduled = output<Meeting>();

  protected readonly now = new Date();
  protected readonly saving = signal(false);
  protected readonly contests = signal<Contest[]>([]);
  protected readonly contestsLoading = signal(false);
  private readonly selectedContestId = signal<number | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    contestId: [null as number | null, Validators.required],
    start: [null as Date | null, Validators.required],
    title: ['', Validators.maxLength(500)],
  });

  /** Конкурсы, у которых есть следующее заседание этапа. */
  protected readonly contestOptions = computed(() =>
    this.contests()
      .filter((contest) => contest.id !== undefined && nextStageMeeting(contest.status) !== null)
      .map((contest) => ({ value: contest.id as number, label: contest.name || `#${contest.id}` })),
  );
  protected readonly stage = computed<MeetingType | null>(() => {
    const contest = this.contests().find((item) => item.id === this.selectedContestId());

    return contest ? nextStageMeeting(contest.status) : null;
  });

  constructor() {
    this.form.controls.contestId.valueChanges.subscribe((value) => this.selectedContestId.set(value));

    effect(() => {
      if (this.visible()) untracked(() => this.open());
    });
  }

  protected submit(): void {
    const type = this.stage();
    const { contestId, start, title } = this.form.getRawValue();

    if (this.form.invalid || !type || contestId === null || !start) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    this.api
      .schedule({ type, contestId, startDateTime: toServerDateTime(start), title: title.trim() || undefined })
      .subscribe({
        next: (meeting) => {
          this.saving.set(false);
          this.notify.success(this.lang.get('staff-meetings.schedule.success'));
          this.visible.set(false);
          this.scheduled.emit(meeting);
        },
        error: () => this.saving.set(false),
      });
  }

  private open(): void {
    this.form.reset({ contestId: this.contestId(), start: null, title: '' });
    this.selectedContestId.set(this.contestId());
    this.contestsLoading.set(true);
    this.contestApi.all({ size: 200, sort: 'createdAt,desc' }).subscribe({
      next: (result) => {
        this.contests.set(result.content);
        this.contestsLoading.set(false);
      },
      error: () => this.contestsLoading.set(false),
    });
  }
}
