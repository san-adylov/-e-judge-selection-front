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
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { catchError, of } from 'rxjs';

import { AssessmentApi } from '@domain/api/assessment.api';
import { INTERVIEW_MAX_SCORE } from '@features/rating/score-breakdown';
import { NotifyService } from '@shared/ui/notify.service';

import {
  type Assessment,
  type CriteriaDraft,
  draftFrom,
  draftTotal,
  INTERVIEW_CRITERIA,
  type InterviewCriterion,
  isCompleteDraft,
  toAssessmentRequest,
} from './interview-rules';

/**
 * Оценки члена Совета по критериям собеседования: `GET /interviews/my` → форма → `PATCH /interviews/assessment`.
 * Бэкенд принимает оценку только у участника открытого заседания по разблокированному кандидату (4200).
 */
@Component({
  selector: 'app-interview-assessment',
  imports: [FormsModule, LangPipe, Button, InputNumber, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="m-0 text-base font-semibold">{{ 'staff-interviews.assessment.title' | lang }}</h2>
        <span class="text-sm text-surface-600">
          {{ 'staff-interviews.assessment.total' | lang: { score: total(), max: maxTotal } }}
        </span>
      </div>

      @if (!editable()) {
        <p-message severity="info" icon="pi pi-lock" [text]="'staff-interviews.assessment.locked' | lang" />
      }

      <div class="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        @for (key of criteria; track key) {
          <div class="flex items-center gap-3 rounded-lg border border-surface-200 p-3">
            <label class="min-w-0 flex-1 text-sm font-medium" [for]="'criterion-' + key">
              {{ 'staff-interviews.criteria.' + key | lang }}
            </label>
            <p-inputnumber
              [inputId]="'criterion-' + key"
              styleClass="w-24"
              inputStyleClass="w-24 text-right"
              mode="decimal"
              [min]="0"
              [max]="max"
              [step]="1"
              [maxFractionDigits]="1"
              [showButtons]="true"
              [useGrouping]="false"
              [disabled]="!editable() || saving()"
              [ngModel]="draft()[key]"
              (ngModelChange)="set(key, $event)"
            />
          </div>
        }
      </div>

      @if (saved(); as result) {
        <p class="m-0 text-sm text-surface-600">
          {{
            'staff-interviews.assessment.saved-total'
              | lang: { mine: result.memberTotal ?? 0, all: result.totalScore ?? 0 }
          }}
        </p>
      }

      @if (editable()) {
        <div class="flex justify-end">
          <p-button
            icon="pi pi-save"
            [label]="'staff-interviews.assessment.submit' | lang"
            [loading]="saving()"
            [disabled]="!complete()"
            (onClick)="save()"
          />
        </div>
      }
    </section>
  `,
})
export class InterviewAssessmentComponent {
  private readonly api = inject(AssessmentApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly meetingId = input.required<number>();
  readonly applicationId = input.required<number>();
  /** Заседание открыто и кандидат разблокирован. */
  readonly editable = input(false);
  readonly assessed = output<Assessment>();

  protected readonly criteria = INTERVIEW_CRITERIA;
  protected readonly max = INTERVIEW_MAX_SCORE;
  protected readonly maxTotal = INTERVIEW_MAX_SCORE * INTERVIEW_CRITERIA.length;
  protected readonly draft = signal<CriteriaDraft>(draftFrom(null));
  protected readonly saved = signal<Assessment | null>(null);
  protected readonly saving = signal(false);
  protected readonly total = computed(() => draftTotal(this.draft()));
  protected readonly complete = computed(() => isCompleteDraft(this.draft()));

  constructor() {
    effect(() => {
      const meetingId = this.meetingId();
      const applicationId = this.applicationId();

      untracked(() => this.load(meetingId, applicationId));
    });
  }

  protected set(key: InterviewCriterion, value: number | null): void {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  protected save(): void {
    if (!this.complete()) return;

    this.saving.set(true);
    this.api.assessInterview(this.meetingId(), this.applicationId(), toAssessmentRequest(this.draft())).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.saved.set(result);
        this.notify.success(this.lang.get('staff-interviews.assessment.saved'));
        this.assessed.emit(result);
      },
      error: () => this.saving.set(false),
    });
  }

  private load(meetingId: number, applicationId: number): void {
    this.saved.set(null);
    this.api
      .myInterviewAssessment(meetingId, applicationId)
      .pipe(catchError(() => of<Assessment | null>(null)))
      .subscribe((assessment) => {
        this.draft.set(draftFrom(assessment));
        if (assessment?.criteriaScores && Object.keys(assessment.criteriaScores).length) this.saved.set(assessment);
      });
  }
}
