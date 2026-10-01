import { DOCUMENT } from '@angular/common';
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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { catchError, filter, of, switchMap, timer } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { AssessmentApi } from '@domain/api/assessment.api';
import { MeetingsApi } from '@domain/api/meetings.api';
import { CandidateDossierComponent } from '@features/candidate-dossier/candidate-dossier.component';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { InterviewAssessmentComponent } from './interview-assessment.component';
import { type InterviewCandidate, INTERVIEWS_URL, sortCandidates } from './interview-rules';

type Meeting = Schemas['MeetingResponse'];

/** Разблокирует председатель на экране заседания — список подтягиваем фоновым опросом. */
const POLL_MS = 10_000;

/**
 * Собеседования (`/administrative/interviews?meetingId=&applicationId=`): кандидаты заседания типа INTERVIEW
 * с признаком «открыт председателем», оценка по критериям и личное дело выбранного кандидата.
 * Голосование по кандидату — на экране заседания.
 */
@Component({
  selector: 'app-interviews-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    ServerDateTimePipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Message,
    Select,
    Skeleton,
    PageHeaderComponent,
    StatusTagComponent,
    CandidateDossierComponent,
    InterviewAssessmentComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './interviews.page.html',
})
export default class InterviewsPage {
  private readonly meetingsApi = inject(MeetingsApi);
  private readonly assessment = inject(AssessmentApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  /** Query-параметры: заседание и выбранный кандидат. */
  readonly meetingId = input<string | undefined>();
  readonly applicationId = input<string | undefined>();

  protected readonly baseUrl = INTERVIEWS_URL;
  protected readonly meetings = signal<Meeting[]>([]);
  protected readonly meetingsLoading = signal(true);
  protected readonly candidates = signal<InterviewCandidate[]>([]);
  protected readonly candidatesLoading = signal(false);
  protected readonly unlocking = signal<number | null>(null);

  protected readonly selectedMeetingId = computed(() => {
    const id = Number(this.meetingId());

    return Number.isInteger(id) && id > 0 ? id : null;
  });
  protected readonly selectedApplicationId = computed(() => {
    const id = Number(this.applicationId());

    return Number.isInteger(id) && id > 0 ? id : null;
  });
  protected readonly meeting = computed(
    () => this.meetings().find((item) => item.id === this.selectedMeetingId()) ?? null,
  );
  protected readonly meetingOptions = computed(() => {
    this.lang.currentLang();

    return this.meetings()
      .filter((meeting) => meeting.id !== undefined)
      .map((meeting) => ({
        value: meeting.id as number,
        label: `${meeting.title || `#${meeting.id}`} · ${this.lang.get(`status.meeting.${meeting.status}`)}`,
      }));
  });
  protected readonly sorted = computed(() => sortCandidates(this.candidates()));
  protected readonly current = computed(
    () => this.candidates().find((item) => item.applicationId === this.selectedApplicationId()) ?? null,
  );
  protected readonly opened = computed(() => this.meeting()?.status === 'OPENED');
  /** Разблокировать может председательствующий на заседании (`gate.unlock`: meeting chairman only). */
  protected readonly canUnlock = computed(() => {
    const meeting = this.meeting();

    return !!meeting && this.opened() && meeting.chairmanId === this.session.user()?.id;
  });
  protected readonly editable = computed(() => this.opened() && this.current()?.active === true);

  constructor() {
    this.meetingsApi
      .byStatus(['APPOINTED', 'OPENED'], { size: 100, sort: 'startDateTime,desc' })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (result) => {
          this.meetings.set(result.content.filter((meeting) => meeting.type === 'INTERVIEW'));
          this.meetingsLoading.set(false);
        },
        error: () => this.meetingsLoading.set(false),
      });

    effect(() => {
      const meeting = this.meeting();

      untracked(() => this.loadCandidates(meeting, true));
    });

    timer(POLL_MS, POLL_MS)
      .pipe(
        filter(() => this.opened() && this.document.visibilityState === 'visible' && !this.candidatesLoading()),
        switchMap(() => this.fetchCandidates(this.meeting())),
        takeUntilDestroyed(),
      )
      .subscribe((candidates) => candidates && this.candidates.set(candidates));
  }

  protected setMeeting(meetingId: number | null): void {
    this.navigate({ meetingId, applicationId: null });
  }

  protected select(candidate: InterviewCandidate): void {
    this.navigate({ meetingId: this.selectedMeetingId(), applicationId: candidate.applicationId ?? null });
  }

  protected unlock(candidate: InterviewCandidate): void {
    const meetingId = this.selectedMeetingId();
    const applicationId = candidate.applicationId;

    if (meetingId === null || applicationId === undefined) return;

    this.unlocking.set(applicationId);
    this.meetingsApi.unlockCandidate(meetingId, applicationId).subscribe({
      next: () => {
        this.unlocking.set(null);
        this.notify.success(this.lang.get('staff-interviews.unlock.success'));
        this.loadCandidates(this.meeting(), false);
      },
      error: () => this.unlocking.set(null),
    });
  }

  protected refresh(): void {
    this.loadCandidates(this.meeting(), false);
  }

  private navigate(params: { meetingId: number | null; applicationId: number | null }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { meetingId: params.meetingId, applicationId: params.applicationId },
      replaceUrl: true,
    });
  }

  private fetchCandidates(meeting: Meeting | null) {
    if (!meeting?.id || !meeting.contestId) return of<InterviewCandidate[] | null>(null);

    return this.assessment.interviewCandidates({ contestId: meeting.contestId, meetingId: meeting.id, size: 200 }).pipe(
      switchMap((page) => of(page.content)),
      catchError(() => of<InterviewCandidate[] | null>(null)),
    );
  }

  private loadCandidates(meeting: Meeting | null, initial: boolean): void {
    if (!meeting) {
      this.candidates.set([]);

      return;
    }

    if (initial) this.candidatesLoading.set(true);

    this.fetchCandidates(meeting)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((candidates) => {
        if (candidates) this.candidates.set(candidates);
        this.candidatesLoading.set(false);
      });
  }
}
