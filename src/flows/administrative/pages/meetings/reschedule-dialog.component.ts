import {
  ChangeDetectionStrategy,
  Component,
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

import { MeetingsApi } from '@domain/api/meetings.api';
import { toServerDateTime } from '@shared/lib/dates';
import { parseServerDateTime } from '@shared/lib/dates';
import { NotifyService } from '@shared/ui/notify.service';

import type { Meeting } from './meeting-rules';

/** Перенос заседания председателем (`PATCH /meeting/{id}`): новое время не раньше текущего момента. */
@Component({
  selector: 'app-reschedule-dialog',
  imports: [FormsModule, LangPipe, Button, DatePicker, Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-md mx-4"
      [modal]="true"
      [header]="'staff-meetings.reschedule.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium" for="reschedule-start">{{ 'staff-meetings.schedule.start' | lang }}</label>
          <p-datepicker
            inputId="reschedule-start"
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
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            icon="pi pi-calendar"
            [label]="'staff-meetings.reschedule.submit' | lang"
            [loading]="saving()"
            [disabled]="!start()"
            (onClick)="submit()"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class RescheduleDialogComponent {
  private readonly api = inject(MeetingsApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly meeting = input.required<Meeting>();
  readonly rescheduled = output<Meeting>();

  protected readonly now = new Date();
  protected readonly start = signal<Date | null>(null);
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.start.set(parseServerDateTime(this.meeting().startDateTime)));
    });
  }

  protected submit(): void {
    const start = this.start();
    const id = this.meeting().id;

    if (!start || id === undefined) return;

    this.saving.set(true);
    this.api.reschedule(id, { startDateTime: toServerDateTime(start) }).subscribe({
      next: (meeting) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('staff-meetings.reschedule.success'));
        this.visible.set(false);
        this.rescheduled.emit(meeting);
      },
      error: () => this.saving.set(false),
    });
  }
}
