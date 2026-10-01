import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Skeleton } from 'primeng/skeleton';
import { catchError, map, type Observable, of } from 'rxjs';

import { AssessmentApi } from '@domain/api/assessment.api';
import { ComplaintsApi } from '@domain/api/complaints.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { VacanciesApi } from '@domain/api/vacancies.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { SessionService } from '@shared/auth/session.service';
import { type StatusKind, StatusTagComponent } from '@shared/ui/status-tag.component';

import { agendaSubjectId, type Meeting, subjectKind } from './meeting-rules';
import { VotePanelComponent } from './vote-panel.component';

/** Предмет голосования в списке: id для `POST /vote`, подпись, ссылка на карточку, статус для метки. */
export interface Subject {
  id: number;
  title: string;
  subtitle?: string;
  link?: unknown[];
  status?: string;
  statusKind?: StatusKind;
  /** Собеседование: кандидат ещё не открыт председателем — голосовать нельзя. */
  locked?: boolean;
}

/**
 * Предметы голосования заседания по его типу (`VoteSubjectResolver`): повестка конкурса или вакансии — один
 * предмет; допуск и собеседование — заявки конкурса в нужном статусе; жалобы — материалы заседания;
 * трек судьи — заявка судьи; утверждение кандидата — отклики на вакансию.
 */
@Component({
  selector: 'app-meeting-subjects',
  imports: [RouterLink, LangPipe, Skeleton, StatusTagComponent, VotePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (loading()) {
      <p-skeleton height="8rem" borderRadius="0.75rem" />
    } @else {
      @for (subject of subjects(); track subject.id) {
        <section class="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
          <header class="flex flex-wrap items-center gap-2">
            <div class="flex min-w-0 flex-1 flex-col">
              @if (subject.link) {
                <a class="font-semibold text-primary no-underline hover:underline" [routerLink]="subject.link">
                  {{ subject.title }}
                </a>
              } @else {
                <span class="font-semibold">{{ subject.title }}</span>
              }
              @if (subject.subtitle) {
                <span class="text-sm text-surface-500">{{ subject.subtitle }}</span>
              }
            </div>
            @if (subject.status && subject.statusKind) {
              <app-status-tag [kind]="subject.statusKind" [value]="subject.status" />
            }
            @if (subject.locked) {
              <span class="inline-flex items-center gap-1 text-sm text-surface-500">
                <i class="pi pi-lock text-xs" aria-hidden="true"></i>{{ 'staff-interviews.state.locked' | lang }}
              </span>
            }
          </header>
          <app-vote-panel
            [meetingId]="meeting().id!"
            [subjectId]="subject.id"
            [subjectLabel]="subject.title"
            [canVote]="canVote() && !subject.locked"
            [version]="version()"
          />
        </section>
      } @empty {
        <p class="m-0 rounded-xl border border-surface-200 bg-surface-0 p-6 text-center text-sm text-surface-500">
          {{ 'staff-meetings.subjects.empty' | lang }}
        </p>
      }
    }
  `,
})
export class MeetingSubjectsComponent {
  private readonly applications = inject(ContestApplicationApi);
  private readonly assessment = inject(AssessmentApi);
  private readonly complaints = inject(ComplaintsApi);
  private readonly judges = inject(JudgeApplicationsApi);
  private readonly vacancies = inject(VacanciesApi);
  private readonly names = inject(CandidateNamesStore);
  private readonly session = inject(SessionService);

  readonly meeting = input.required<Meeting>();
  readonly canVote = input(false);
  /** Счётчик перезагрузки (события SSE). */
  readonly version = input(0);

  protected readonly loading = signal(false);
  private readonly loaded = signal<Subject[]>([]);
  private readonly candidateOf = new Map<number, number>();
  /** Имена кандидатов подставляются по мере загрузки профилей. */
  protected readonly subjects = computed(() => {
    const names = this.names.namesOf([])();

    return this.loaded().map((subject) => {
      const candidateId = this.candidateOf.get(subject.id);
      const name = candidateId === undefined ? undefined : names.get(candidateId);

      return name ? { ...subject, title: name } : subject;
    });
  });

  constructor() {
    effect(() => {
      const meeting = this.meeting();

      this.version();
      untracked(() => this.load(meeting));
    });
  }

  private load(meeting: Meeting): void {
    this.loading.set(true);
    this.candidateOf.clear();
    this.fetch(meeting)
      .pipe(catchError(() => of<Subject[]>([])))
      .subscribe((subjects) => {
        this.loaded.set(subjects);
        this.loading.set(false);
      });
  }

  private fetch(meeting: Meeting): Observable<Subject[]> {
    const kind = subjectKind(meeting.type);
    const meetingId = meeting.id ?? 0;

    // Повестка конкурса и вакансии — один предмет голосования.
    if (kind === 'CONTEST_AGENDA' || kind === 'VACANCY_AGENDA') {
      const id = agendaSubjectId(meeting);
      const link = kind === 'CONTEST_AGENDA' ? ['/administrative/contests', id] : ['/administrative/vacancies', id];

      return of(id === null ? [] : [{ id, title: meeting.title || `#${id}`, link }]);
    }

    if (kind === 'APPLICATION') return this.applicationSubjects(meeting, meetingId);
    if (kind === 'COMPLAINT') return this.complaintSubjects(meetingId);
    if (kind === 'JUDGE_APPLICATION') return this.judgeSubjects(meeting.judgeApplicationId);
    if (kind === 'VACANCY_APPLICATION') return this.vacancyApplicationSubjects(meeting.vacancyId);

    return of([]);
  }

  private complaintSubjects(meetingId: number): Observable<Subject[]> {
    return this.complaints.reviewMaterials(meetingId).pipe(
      map((materials) =>
        (materials.complaints ?? [])
          .map((item) => item.complaint)
          .filter((complaint): complaint is NonNullable<typeof complaint> => !!complaint?.id)
          .map((complaint) => ({
            id: complaint.id!,
            title: `#${complaint.id}`,
            subtitle: complaint.text?.slice(0, 160),
            status: complaint.status,
            statusKind: 'complaint' as const,
            link: ['/administrative/complaints'],
          })),
      ),
    );
  }

  private judgeSubjects(id: number | undefined): Observable<Subject[]> {
    if (id === undefined) return of([]);

    return this.judges.get(id).pipe(
      map((application) => [
        {
          id,
          title: application.contestName || `#${id}`,
          subtitle: application.registrationNumber ? `№ ${application.registrationNumber}` : undefined,
          status: application.status,
          statusKind: 'judgeApplication' as const,
          link: ['/administrative/judges'],
        },
      ]),
    );
  }

  private vacancyApplicationSubjects(vacancyId: number | undefined): Observable<Subject[]> {
    if (vacancyId === undefined) return of([]);

    return this.vacancies.applicationsByVacancy(vacancyId).pipe(
      map((items) =>
        items
          .filter((item) => item.id !== undefined)
          .map((item) => ({
            id: item.id!,
            title: item.candidateFullName || `#${item.id}`,
            status: item.status,
            statusKind: 'vacancyApplication' as const,
            link: ['/administrative/vacancies', vacancyId],
          })),
      ),
    );
  }

  /** Допуск: заявки у Совета; собеседование: ожидающие собеседования с признаком «открыт» (только Совету). */
  private applicationSubjects(meeting: Meeting, meetingId: number): Observable<Subject[]> {
    const contestId = meeting.contestId;

    if (contestId === undefined) return of([]);

    if (meeting.type === 'INTERVIEW' && this.session.can('BOARD')) {
      return this.assessment.interviewCandidates({ contestId, meetingId, size: 200 }).pipe(
        map((page) =>
          page.content
            .filter((item) => item.applicationId !== undefined)
            .map((item) => ({
              id: item.applicationId!,
              title: item.candidateFullName || `#${item.applicationId}`,
              subtitle: item.registrationNumber ? `№ ${item.registrationNumber}` : undefined,
              locked: item.active !== true,
              link: ['/administrative/applications', item.applicationId],
            })),
        ),
      );
    }

    const status = meeting.type === 'INTERVIEW' ? 'PENDING_INTERVIEW' : 'PENDING_BOARD_REVIEW';

    return this.applications.byContest(contestId, [status], { size: 200 }).pipe(
      map((page) => {
        page.content.forEach((item) => {
          if (item.id !== undefined && item.candidateId !== undefined) this.candidateOf.set(item.id, item.candidateId);
        });
        this.names.namesOf(page.content.map((item) => item.candidateId));

        return page.content
          .filter((item) => item.id !== undefined)
          .map((item) => ({
            id: item.id!,
            title: `#${item.id}`,
            subtitle: item.registrationNumber ? `№ ${item.registrationNumber}` : undefined,
            status: item.status,
            statusKind: 'application' as const,
            link: ['/administrative/applications', item.id],
          }));
      }),
    );
  }
}
