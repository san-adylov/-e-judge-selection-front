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
import { Dialog } from 'primeng/dialog';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';

import type { Schemas } from '@domain/api/api.types';
import { VotesApi } from '@domain/api/votes.api';
import { NotifyService } from '@shared/ui/notify.service';

import { VOTE_REASON_MAX } from './meeting-rules';

type Choice = Schemas['CastVoteRequest']['voteChoice'];
type Vote = Schemas['VoteResponse'];

/** Голос «за» или «против» с причиной (обязательна для «против», до 2000 символов): `POST /vote`. */
@Component({
  selector: 'app-vote-dialog',
  imports: [FormsModule, LangPipe, Button, Dialog, SelectButton, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-lg mx-4"
      [modal]="true"
      [header]="'staff-meetings.vote.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <div class="flex flex-col gap-4">
        @if (subjectLabel()) {
          <p class="m-0 font-medium">{{ subjectLabel() }}</p>
        }
        <p-selectbutton
          optionLabel="label"
          optionValue="value"
          [options]="choices()"
          [allowEmpty]="false"
          [ngModel]="choice()"
          (ngModelChange)="choice.set($event)"
        />
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium" for="vote-reason">
            {{ 'staff-meetings.vote.reason' | lang }}
            @if (choice() === 'AGAINST') {
              <span class="text-red-600" aria-hidden="true">*</span>
            }
          </label>
          <textarea
            pTextarea
            id="vote-reason"
            class="w-full"
            rows="4"
            [autoResize]="true"
            [maxlength]="reasonMax"
            [placeholder]="'staff-meetings.vote.reason-placeholder' | lang"
            [ngModel]="reason()"
            (ngModelChange)="reason.set($event)"
          ></textarea>
          <small class="text-surface-500">{{ 'staff-meetings.vote.sign-hint' | lang }}</small>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            [icon]="choice() === 'FOR' ? 'pi pi-thumbs-up' : 'pi pi-thumbs-down'"
            [severity]="choice() === 'FOR' ? 'success' : 'danger'"
            [label]="'staff-meetings.vote.submit' | lang"
            [loading]="saving()"
            [disabled]="!valid()"
            (onClick)="submit()"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class VoteDialogComponent {
  private readonly api = inject(VotesApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly meetingId = input.required<number>();
  readonly subjectId = input.required<number>();
  readonly subjectLabel = input('');
  readonly voted = output<Vote>();

  protected readonly reasonMax = VOTE_REASON_MAX;
  protected readonly choice = signal<Choice>('FOR');
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly choices = computed(() => {
    this.lang.currentLang();

    return (['FOR', 'AGAINST'] as const).map((value) => ({
      value,
      label: this.lang.get(`staff-meetings.vote.${value}`),
    }));
  });
  protected readonly valid = computed(() => this.choice() === 'FOR' || this.reason().trim().length > 0);

  constructor() {
    effect(() => {
      if (this.visible()) {
        untracked(() => {
          this.choice.set('FOR');
          this.reason.set('');
        });
      }
    });
  }

  protected submit(): void {
    if (!this.valid()) return;

    const reason = this.reason().trim();

    this.saving.set(true);
    this.api
      .cast({
        meetingId: this.meetingId(),
        subjectId: this.subjectId(),
        voteChoice: this.choice(),
        reason: reason || undefined,
      })
      .subscribe({
        next: (vote) => {
          this.saving.set(false);
          this.notify.success(this.lang.get('staff-meetings.vote.success'));
          this.visible.set(false);
          this.voted.emit(vote);
        },
        error: () => this.saving.set(false),
      });
  }
}
