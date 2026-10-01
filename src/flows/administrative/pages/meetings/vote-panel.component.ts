import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { catchError, forkJoin, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { VotesApi } from '@domain/api/votes.api';
import { OepSigningDialogComponent } from '@features/oep-signing/oep-signing-dialog.component';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';

import { VoteDialogComponent } from './vote-dialog.component';

type Vote = Schemas['VoteResponse'];
type Summary = Schemas['VoteSummaryResponse'];

/**
 * Голосование по одному предмету заседания: итог (`GET /vote/{id}/summary`), голоса с причинами
 * (`GET /vote/{id}?subjectId`), свой голос и подпись ОЭП после него (голос считается подписанным
 * только после `POST /oep/sign` с `voteId`).
 */
@Component({
  selector: 'app-vote-panel',
  imports: [LangPipe, ServerDateTimePipe, Button, VoteDialogComponent, OepSigningDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (summary(); as result) {
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <span class="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 font-medium text-green-800">
          <i class="pi pi-thumbs-up text-xs" aria-hidden="true"></i>
          {{ 'staff-meetings.vote.FOR' | lang }}: {{ result.votesFor ?? 0 }}
        </span>
        <span class="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 font-medium text-red-800">
          <i class="pi pi-thumbs-down text-xs" aria-hidden="true"></i>
          {{ 'staff-meetings.vote.AGAINST' | lang }}: {{ result.votesAgainst ?? 0 }}
        </span>
        <span class="text-surface-500">
          {{ 'staff-meetings.vote.participants' | lang: { voted: votedCount(), total: result.participants ?? 0 } }}
        </span>
        @if (result.allVoted) {
          <span
            class="inline-flex items-center gap-1"
            [class.text-green-700]="result.approved"
            [class.text-red-700]="!result.approved"
          >
            <i
              class="pi"
              [class.pi-check-circle]="result.approved"
              [class.pi-times-circle]="!result.approved"
              aria-hidden="true"
            ></i>
            {{ (result.approved ? 'staff-meetings.vote.approved' : 'staff-meetings.vote.declined') | lang }}
            @if (result.decidedByChairman) {
              ({{ 'staff-meetings.vote.by-chairman' | lang }})
            }
          </span>
        }
      </div>
    }

    @if (votes().length) {
      <ul class="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        @for (vote of votes(); track vote.id) {
          <li class="flex flex-wrap items-start gap-2 rounded-lg bg-surface-50 px-3 py-2">
            <i
              class="pi mt-0.5"
              aria-hidden="true"
              [class.pi-thumbs-up]="vote.voteChoice === 'FOR'"
              [class.text-green-600]="vote.voteChoice === 'FOR'"
              [class.pi-thumbs-down]="vote.voteChoice === 'AGAINST'"
              [class.text-red-600]="vote.voteChoice === 'AGAINST'"
            ></i>
            <span class="font-medium">{{ vote.voterFullName || '—' }}</span>
            @if (vote.reason) {
              <span class="min-w-0 flex-1 whitespace-pre-line text-surface-700">{{ vote.reason }}</span>
            }
            <span class="ml-auto text-xs text-surface-500">
              {{ vote.createdAt | serverDateTime }}
              @if (vote.signed) {
                ·
                <i
                  class="pi pi-verified text-green-600"
                  [title]="'staff-meetings.vote.signed' | lang"
                  aria-hidden="true"
                ></i>
              }
            </span>
          </li>
        }
      </ul>
    }

    @if (canVote()) {
      <div class="flex flex-wrap items-center gap-2">
        @if (myVote(); as mine) {
          @if (!mine.signed) {
            <p-button
              size="small"
              icon="pi pi-pencil"
              severity="warn"
              [label]="'staff-meetings.vote.sign' | lang"
              (onClick)="signVote(mine)"
            />
          } @else {
            <span class="text-sm text-green-700">{{ 'staff-meetings.vote.mine-signed' | lang }}</span>
          }
        } @else {
          <p-button
            size="small"
            icon="pi pi-check-square"
            [label]="'staff-meetings.vote.action' | lang"
            (onClick)="voting.set(true)"
          />
        }
      </div>
    }

    <app-vote-dialog
      [(visible)]="voting"
      [meetingId]="meetingId()"
      [subjectId]="subjectId()"
      [subjectLabel]="subjectLabel()"
      (voted)="onVoted($event)"
    />
    @if (signContext(); as context) {
      <app-oep-signing-dialog [(visible)]="signing" [context]="context" (signed)="reload()" />
    }
  `,
})
export class VotePanelComponent {
  private readonly api = inject(VotesApi);
  private readonly session = inject(SessionService);

  readonly meetingId = input.required<number>();
  readonly subjectId = input.required<number>();
  readonly subjectLabel = input('');
  /** Открытое заседание, пользователь — участник с ролью Совета. */
  readonly canVote = input(false);
  /** Счётчик перезагрузки от родителя (события SSE). */
  readonly version = input(0);
  readonly changed = output<void>();

  protected readonly summary = signal<Summary | null>(null);
  protected readonly votes = signal<Vote[]>([]);
  protected readonly voting = signal(false);
  protected readonly signing = signal(false);
  protected readonly signContext = signal<Schemas['SignRequest'] | null>(null);

  protected readonly votedCount = computed(
    () => this.summary()?.participantStatuses?.filter((status) => status.voted).length ?? this.votes().length,
  );
  protected readonly myVote = computed(() => {
    const userId = this.session.user()?.id;

    return this.votes().find((vote) => vote.voterId === userId) ?? null;
  });

  constructor() {
    effect(() => {
      this.meetingId();
      this.subjectId();
      this.version();
      untracked(() => this.reload());
    });
  }

  protected reload(): void {
    const meetingId = this.meetingId();
    const subjectId = this.subjectId();

    forkJoin({
      summary: this.api.summary(meetingId, subjectId).pipe(catchError(() => of<Summary | null>(null))),
      votes: this.api.list(meetingId, subjectId).pipe(catchError(() => of<Vote[]>([]))),
    }).subscribe(({ summary, votes }) => {
      this.summary.set(summary);
      this.votes.set(votes);
    });
  }

  protected onVoted(vote: Vote): void {
    this.changed.emit();
    this.reload();
    this.signVote(vote);
  }

  protected signVote(vote: Vote): void {
    if (vote.id === undefined) return;

    this.signContext.set({ meetingId: this.meetingId(), voteId: vote.id });
    this.signing.set(true);
  }
}
