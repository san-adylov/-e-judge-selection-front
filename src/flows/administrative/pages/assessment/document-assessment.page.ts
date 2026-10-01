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
import { LangPipe } from '@reforgium/presentia';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { catchError, forkJoin, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { AssessmentApi } from '@domain/api/assessment.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { CandidateDossierComponent } from '@features/candidate-dossier/candidate-dossier.component';
import { skipErrorToast } from '@shared/api/http-context';
import { SessionService } from '@shared/auth/session.service';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { AssessmentPickerComponent } from './assessment-picker.component';
import { ASSESSMENT_URL, scoreRows } from './assessment-rules';
import { ScorePanelComponent } from './score-panel.component';

type Application = Schemas['ApplicationResponse'];
type Summary = Schemas['AssessmentSummaryResponse'];
type Score = Schemas['SectionScoreResponse'];

/**
 * Оценка документов (`/administrative/document-assessment?applicationId=`): личное дело кандидата и баллы по
 * разделам. Выставляет только назначенный докладчик, пока заявка у Совета; остальные члены Совета смотрят.
 * Без `applicationId` — выбор заявки.
 */
@Component({
  selector: 'app-document-assessment-page',
  imports: [
    RouterLink,
    LangPipe,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Message,
    Skeleton,
    PageHeaderComponent,
    StatusTagComponent,
    AssessmentPickerComponent,
    CandidateDossierComponent,
    ScorePanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (id() === null) {
      <app-page-header title="staff-assessment.title" subtitle="staff-assessment.subtitle" />
      <app-assessment-picker />
    } @else {
      <div class="flex max-w-6xl flex-col gap-4">
        <a
          class="inline-flex items-center gap-1 self-start text-sm text-primary no-underline hover:underline"
          [routerLink]="baseUrl"
        >
          <i class="pi pi-angle-left text-xs" aria-hidden="true"></i>
          {{ 'staff-assessment.back' | lang }}
        </a>

        @if (loading()) {
          <p-skeleton height="2.5rem" width="60%" />
          <p-skeleton height="14rem" borderRadius="0.75rem" />
        } @else if (!application()) {
          <section
            class="flex flex-col items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 p-8 text-center"
          >
            <i class="pi pi-file-excel text-4xl text-surface-400" aria-hidden="true"></i>
            <p class="m-0 font-medium">{{ 'shell.not-found' | lang }}</p>
            <a pButton [routerLink]="baseUrl">
              <i pButtonIcon class="pi pi-list"></i>
              <span pButtonLabel>{{ 'staff-assessment.back' | lang }}</span>
            </a>
          </section>
        } @else {
          @let app = application()!;

          <header class="flex flex-col gap-3 desktop-s:flex-row desktop-s:items-start">
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <app-status-tag kind="application" [value]="app.status" />
                @if (app.registrationNumber) {
                  <span class="text-sm text-surface-500">№ {{ app.registrationNumber }}</span>
                }
              </div>
              <h1 class="m-0 text-2xl font-semibold break-words">
                {{ candidateName() || ('staff-applications.detail.candidate-unknown' | lang) }}
              </h1>
              <a
                class="text-sm text-primary no-underline hover:underline"
                [routerLink]="['/administrative/contests', app.contestId]"
              >
                {{ app.contestName || ('applications.card.no-contest-name' | lang) }}
              </a>
            </div>
            <a pButton severity="secondary" [outlined]="true" [routerLink]="['/administrative/applications', app.id]">
              <i pButtonIcon class="pi pi-file-edit"></i>
              <span pButtonLabel>{{ 'staff-assessment.to-application' | lang }}</span>
            </a>
          </header>

          @if (!editable() && isReporter()) {
            <p-message severity="info" icon="pi pi-lock" [text]="'staff-assessment.closed' | lang" />
          }

          <app-score-panel
            [applicationId]="app.id!"
            [rows]="rows()"
            [editable]="editable()"
            (scored)="reloadScores()"
          />

          @if (app.candidateId; as candidateId) {
            <app-candidate-dossier [userId]="candidateId" [applicationId]="app.id" />
          }
        }
      </div>
    }
  `,
})
export default class DocumentAssessmentPage {
  private readonly applications = inject(ContestApplicationApi);
  private readonly assessment = inject(AssessmentApi);
  private readonly names = inject(CandidateNamesStore);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);

  /** Query-параметр `applicationId`. */
  readonly applicationId = input<string | undefined>();

  protected readonly baseUrl = ASSESSMENT_URL;
  protected readonly id = computed(() => {
    const id = Number(this.applicationId());

    return Number.isInteger(id) && id > 0 ? id : null;
  });
  protected readonly application = signal<Application | null>(null);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly scores = signal<Score[]>([]);
  protected readonly loading = signal(false);

  protected readonly candidateName = computed(() => this.names.name(this.application()?.candidateId)());
  protected readonly rows = computed(() => scoreRows(this.summary(), this.scores()));
  protected readonly isReporter = computed(() => {
    const reporterId = this.application()?.reporterId;

    return reporterId !== undefined && reporterId === this.session.user()?.id;
  });
  /** Бэкенд проверяет только докладчика; после решения Совета менять баллы уже незачем. */
  protected readonly editable = computed(
    () => this.isReporter() && this.application()?.status === 'PENDING_BOARD_REVIEW',
  );

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => (id === null ? this.reset() : this.load(id)));
    });
  }

  protected reloadScores(): void {
    const id = this.id();

    if (id === null) return;

    forkJoin({
      summary: this.assessment.documentSummary(id).pipe(catchError(() => of(null))),
      scores: this.assessment.documentScores(id).pipe(catchError(() => of<Score[]>([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ summary, scores }) => {
        this.summary.set(summary);
        this.scores.set(scores);
      });
  }

  private reset(): void {
    this.application.set(null);
    this.summary.set(null);
    this.scores.set([]);
    this.loading.set(false);
  }

  private load(id: number): void {
    this.loading.set(true);
    forkJoin({
      application: this.applications.get(id, skipErrorToast()).pipe(catchError(() => of(null))),
      summary: this.assessment.documentSummary(id).pipe(catchError(() => of(null))),
      scores: this.assessment.documentScores(id).pipe(catchError(() => of<Score[]>([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ application, summary, scores }) => {
        this.application.set(application);
        this.summary.set(summary);
        this.scores.set(scores);
        this.loading.set(false);
      });
  }
}
