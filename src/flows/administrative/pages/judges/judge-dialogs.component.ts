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
import { Router } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';

import type { MeetingType } from '@domain/api/api.types';
import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { UsersApi } from '@domain/api/users.api';
import { FileUploadComponent } from '@features/files/file-upload.component';
import { toServerDateTime } from '@shared/lib/dates';
import { NotifyService } from '@shared/ui/notify.service';

import type { JudgeApplication } from './judge-rules';

/**
 * Диалоги заявки судьи в одном компоненте (общие состояние и API): смена докладчика (председатель),
 * заседание трека судьи (Совет), приглашение на собеседование (секретарь), прикрепление файла (секретарь).
 */
@Component({
  selector: 'app-judge-dialogs',
  imports: [FormsModule, LangPipe, Button, DatePicker, Dialog, Message, Select, FileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-lg mx-4"
      [modal]="true"
      [header]="'staff-applications.reassign.title' | lang"
      [visible]="reassignOpen()"
      (visibleChange)="reassignOpen.set($event)"
    >
      <div class="flex flex-col gap-4">
        @if (!members().length) {
          <p-message
            severity="warn"
            icon="pi pi-exclamation-triangle"
            [text]="'staff-applications.reassign.empty' | lang"
          />
        } @else {
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium" for="judge-reporter">{{
              'staff-applications.reassign.member' | lang
            }}</label>
            <p-select
              inputId="judge-reporter"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              styleClass="w-full"
              [options]="members()"
              [placeholder]="'shell.form.select' | lang"
              [ngModel]="reporterId()"
              (ngModelChange)="reporterId.set($event)"
            />
          </div>
        }
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="reassignOpen.set(false)"
          />
          <p-button
            icon="pi pi-user-edit"
            [label]="'staff-applications.actions.reassign' | lang"
            [loading]="saving()"
            [disabled]="reporterId() === null"
            (onClick)="reassign()"
          />
        </div>
      </div>
    </p-dialog>

    <p-dialog
      styleClass="w-full max-w-md mx-4"
      [modal]="true"
      [header]="'staff-meetings.schedule.title' | lang"
      [visible]="meetingOpen()"
      (visibleChange)="meetingOpen.set($event)"
    >
      <div class="flex flex-col gap-4">
        @if (meetingType(); as type) {
          <p-message
            severity="info"
            icon="pi pi-calendar-plus"
            [text]="'staff-meetings.schedule.stage' | lang: { type: ('status.meetingType.' + type | lang) }"
          />
        }
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium" for="judge-meeting-start">{{
            'staff-meetings.schedule.start' | lang
          }}</label>
          <p-datepicker
            inputId="judge-meeting-start"
            dateFormat="dd.mm.yy"
            appendTo="body"
            styleClass="w-full"
            [showTime]="true"
            [showIcon]="true"
            [minDate]="now"
            [ngModel]="meetingStart()"
            (ngModelChange)="meetingStart.set($event)"
          />
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="meetingOpen.set(false)"
          />
          <p-button
            icon="pi pi-calendar-plus"
            [label]="'staff-meetings.schedule.submit' | lang"
            [loading]="saving()"
            [disabled]="!meetingStart()"
            (onClick)="scheduleMeeting()"
          />
        </div>
      </div>
    </p-dialog>

    <p-dialog
      styleClass="w-full max-w-md mx-4"
      [modal]="true"
      [header]="'staff-judges.invite.title' | lang"
      [visible]="inviteOpen()"
      (visibleChange)="inviteOpen.set($event)"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium" for="judge-invite-start">{{ 'staff-judges.invite.date' | lang }}</label>
          <p-datepicker
            inputId="judge-invite-start"
            dateFormat="dd.mm.yy"
            appendTo="body"
            styleClass="w-full"
            [showTime]="true"
            [showIcon]="true"
            [minDate]="now"
            [ngModel]="inviteAt()"
            (ngModelChange)="inviteAt.set($event)"
          />
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="inviteOpen.set(false)"
          />
          <p-button
            icon="pi pi-send"
            [label]="'staff-judges.invite.submit' | lang"
            [loading]="saving()"
            [disabled]="!inviteAt()"
            (onClick)="invite()"
          />
        </div>
      </div>
    </p-dialog>

    <p-dialog
      styleClass="w-full max-w-md mx-4"
      [modal]="true"
      [header]="'staff-judges.files.attach' | lang"
      [visible]="fileOpen()"
      (visibleChange)="fileOpen.set($event)"
    >
      <div class="flex flex-col gap-4">
        <p class="m-0 text-sm text-surface-600">{{ 'staff-judges.files.hint' | lang }}</p>
        <app-file-upload
          category="JUDGE_DECREE"
          [ownerUserId]="application().judgeUserId"
          [ngModel]="fileId()"
          (ngModelChange)="fileId.set($event)"
        />
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="fileOpen.set(false)"
          />
          <p-button
            icon="pi pi-paperclip"
            [label]="'staff-judges.files.submit' | lang"
            [loading]="saving()"
            [disabled]="fileId() === null"
            (onClick)="attachFile()"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class JudgeDialogsComponent {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly users = inject(UsersApi);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly application = input.required<JudgeApplication>();
  readonly meetingType = input<MeetingType | null>(null);
  readonly reassignOpen = model(false);
  readonly meetingOpen = model(false);
  readonly inviteOpen = model(false);
  readonly fileOpen = model(false);
  readonly changed = output<JudgeApplication>();

  protected readonly now = new Date();
  protected readonly saving = signal(false);
  protected readonly members = signal<{ value: number; label: string }[]>([]);
  protected readonly reporterId = signal<number | null>(null);
  protected readonly meetingStart = signal<Date | null>(null);
  protected readonly inviteAt = signal<Date | null>(null);
  protected readonly fileId = signal<number | null>(null);

  constructor() {
    effect(() => {
      if (this.reassignOpen()) untracked(() => this.loadMembers());
    });
  }

  protected reassign(): void {
    const reporterId = this.reporterId();

    if (reporterId === null) return;

    this.run(this.api.setReporter(this.id(), reporterId), 'staff-applications.reassign.success', this.reassignOpen);
  }

  protected scheduleMeeting(): void {
    const type = this.meetingType();
    const start = this.meetingStart();

    if (!type || !start) return;

    this.saving.set(true);
    this.api.scheduleMeeting(this.id(), { type, startDateTime: toServerDateTime(start) }).subscribe({
      next: (meeting) => {
        this.saving.set(false);
        this.meetingOpen.set(false);
        this.notify.success(this.lang.get('staff-meetings.schedule.success'));
        void this.router.navigate(['/administrative/meetings', meeting.id]);
      },
      error: () => this.saving.set(false),
    });
  }

  protected invite(): void {
    const at = this.inviteAt();

    if (!at) return;

    this.run(
      this.api.inviteInterview(this.id(), { dateTime: toServerDateTime(at) }),
      'staff-judges.invite.success',
      this.inviteOpen,
    );
  }

  protected attachFile(): void {
    const fileId = this.fileId();

    if (fileId === null) return;

    this.run(this.api.attachFile(this.id(), fileId), 'staff-judges.files.success', this.fileOpen);
  }

  private id(): number {
    return this.application().id ?? 0;
  }

  private run(
    request: ReturnType<JudgeApplicationsApi['register']>,
    successKey: string,
    dialog: { set(value: boolean): void },
  ): void {
    this.saving.set(true);
    request.subscribe({
      next: (application) => {
        this.saving.set(false);
        dialog.set(false);
        this.notify.success(this.lang.get(successKey));
        this.changed.emit(application);
      },
      error: () => this.saving.set(false),
    });
  }

  private loadMembers(): void {
    this.reporterId.set(this.application().reporterId ?? null);
    this.users.boardMembers(true).subscribe({
      next: (members) =>
        this.members.set(
          members
            .filter((member) => member.id !== undefined)
            .map((member) => ({ value: member.id as number, label: member.fullName || `#${member.id}` })),
        ),
      error: () => this.members.set([]),
    });
  }
}
