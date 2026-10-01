import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { merge, type Observable } from 'rxjs';

import { ContestApi } from '@domain/api/contest.api';
import { MeetingsApi } from '@domain/api/meetings.api';
import { ContestScheduleComponent } from '@features/contest-info/contest-schedule.component';
import { skipErrorToast } from '@shared/api/http-context';
import { SseService } from '@shared/api/sse.service';
import { AccessDirective } from '@shared/auth/access.directive';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import type { Contest } from '../contests/contest-rules';
import { DecisionsPanelComponent } from './decisions-panel.component';
import { type Meeting, meetingActions, MEETINGS_URL } from './meeting-rules';
import { MeetingSubjectsComponent } from './meeting-subjects.component';
import { OpeningDecisionComponent } from './opening-decision.component';
import { RescheduleDialogComponent } from './reschedule-dialog.component';

/**
 * Заседание (`/administrative/meetings/:id`): участники и кворум, предметы голосования, решения.
 * Действия: присоединиться (Совет), закрыть вручную (Совет, только ручные типы), перенести (председатель).
 * События SSE `joinMeeting`, `meetingStatus`, `vote` перечитывают карточку.
 */
@Component({
  selector: 'app-meeting-detail-page',
  imports: [
    RouterLink,
    LangPipe,
    ServerDateTimePipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Message,
    Skeleton,
    StatusTagComponent,
    AccessDirective,
    ContestScheduleComponent,
    DecisionsPanelComponent,
    MeetingSubjectsComponent,
    OpeningDecisionComponent,
    RescheduleDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meeting-detail.page.html',
})
export default class MeetingDetailPage {
  private readonly api = inject(MeetingsApi);
  private readonly contestApi = inject(ContestApi);
  private readonly session = inject(SessionService);
  private readonly sse = inject(SseService);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly baseUrl = MEETINGS_URL;
  protected readonly meeting = signal<Meeting | null>(null);
  protected readonly contest = signal<Contest | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  protected readonly rescheduling = signal(false);
  /** Растёт при каждом событии SSE — дочерние панели перечитывают данные. */
  protected readonly version = signal(0);

  protected readonly actions = computed(() => {
    const meeting = this.meeting();
    const user = this.session.user();

    return meeting && user ? meetingActions(meeting, { roles: user.roles, userId: user.id }) : null;
  });
  protected readonly showSchedule = computed(() => this.meeting()?.type === 'CALENDAR_APPROVAL' && !!this.contest());

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => this.load(id, true));
    });

    merge(this.sse.on('joinMeeting'), this.sse.on('meetingStatus'), this.sse.on('vote'))
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (String(event.meetingId) !== this.id()) return;

        this.version.update((value) => value + 1);
        this.load(this.id(), false);
      });
  }

  protected join(): void {
    const id = this.meeting()?.id;

    if (id !== undefined) this.run(this.api.join(id), 'staff-meetings.actions.joined');
  }

  protected forceClose(): void {
    const id = this.meeting()?.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('staff-meetings.close.confirm-title'),
      message: this.lang.get('staff-meetings.close.confirm-message'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.lang.get('staff-meetings.actions.force-close'),
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.run(this.api.forceClose(id), 'staff-meetings.close.success'),
    });
  }

  protected onRescheduled(meeting: Meeting): void {
    this.meeting.set(meeting);
  }

  private run(request: Observable<Meeting>, successKey: string): void {
    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (meeting) => {
        this.busy.set(false);
        this.meeting.set(meeting);
        this.version.update((value) => value + 1);
        this.notify.success(this.lang.get(successKey));
      },
      error: () => this.busy.set(false),
    });
  }

  private load(rawId: string, initial: boolean): void {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      this.notFound.set(true);
      this.loading.set(false);

      return;
    }

    if (initial) this.loading.set(true);

    this.api
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meeting) => {
          this.meeting.set(meeting);
          this.notFound.set(false);
          this.loading.set(false);
          if (initial) this.loadContest(meeting);
        },
        error: () => {
          if (initial) this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }

  /** Конкурс нужен календарному заседанию — показать план, который утверждают. */
  private loadContest(meeting: Meeting): void {
    if (meeting.type !== 'CALENDAR_APPROVAL' || meeting.contestId === undefined) return;

    this.contestApi
      .get(meeting.contestId, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (contest) => this.contest.set(contest), error: () => undefined });
  }
}
