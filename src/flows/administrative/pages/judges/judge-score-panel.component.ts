import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';

import type { AssessmentSection } from '@domain/api/api.types';
import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { NotifyService } from '@shared/ui/notify.service';

import { JUDGE_SECTIONS, type JudgeApplication, PROFESSIONAL_MAX_SCORE } from './judge-rules';

/**
 * Оценки заявки судьи: баллы докладчика по разделам документов (`PUT /judge-applications/{id}/document-score`,
 * максимумы трека судьи) и профессиональная оценка члена Совета (`PUT …/professional-score`, 0–100).
 * Сохранённые баллы разделов бэкенд сотрудникам не отдаёт — показываем только то, что ввели в этой сессии.
 */
@Component({
  selector: 'app-judge-score-panel',
  imports: [FormsModule, LangPipe, Button, InputNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    @if (canScoreDocuments()) {
      <section class="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
        <h2 class="m-0 text-base font-semibold">{{ 'staff-judges.scores.documents' | lang }}</h2>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (row of sections; track row.section) {
            <li class="flex items-center gap-3 rounded-lg border border-surface-200 p-3">
              <label class="min-w-0 flex-1 text-sm font-medium" [for]="'judge-score-' + row.section">
                {{ 'staff-assessment.section.' + row.section | lang }}
                <span class="block text-xs font-normal text-surface-500">{{
                  'staff-assessment.scores.max' | lang: { max: row.max }
                }}</span>
              </label>
              <p-inputnumber
                [inputId]="'judge-score-' + row.section"
                styleClass="w-24"
                inputStyleClass="w-24 text-right"
                mode="decimal"
                [min]="0"
                [max]="row.max"
                [step]="0.5"
                [maxFractionDigits]="2"
                [showButtons]="true"
                [useGrouping]="false"
                [ngModel]="draft()[row.section] ?? null"
                (ngModelChange)="set(row.section, $event)"
              />
              <p-button
                size="small"
                icon="pi pi-save"
                [ariaLabel]="'shell.actions.save' | lang"
                [loading]="saving() === row.section"
                [disabled]="!valid(row.section, row.max)"
                (onClick)="saveSection(row.section, row.max)"
              />
            </li>
          }
        </ul>
      </section>
    }

    @if (canScoreProfessional()) {
      <section class="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
        <h2 class="m-0 text-base font-semibold">{{ 'staff-judges.scores.professional' | lang }}</h2>
        <p class="m-0 text-sm text-surface-600">
          {{ 'staff-judges.scores.professional-hint' | lang: { max: professionalMax } }}
          @if (application().professionalScore !== undefined && application().professionalScore !== null) {
            {{ 'staff-judges.scores.professional-current' | lang: { score: application().professionalScore } }}
          }
        </p>
        <div class="flex items-center gap-3">
          <p-inputnumber
            inputId="judge-professional"
            styleClass="w-32"
            inputStyleClass="w-32 text-right"
            mode="decimal"
            [min]="0"
            [max]="professionalMax"
            [maxFractionDigits]="2"
            [showButtons]="true"
            [useGrouping]="false"
            [ngModel]="professional()"
            (ngModelChange)="professional.set($event)"
          />
          <p-button
            icon="pi pi-save"
            [label]="'shell.actions.save' | lang"
            [loading]="saving() === 'PROFESSIONAL'"
            [disabled]="professional() === null"
            (onClick)="saveProfessional()"
          />
        </div>
      </section>
    }
  `,
})
export class JudgeScorePanelComponent {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly application = input.required<JudgeApplication>();
  readonly canScoreDocuments = input(false);
  readonly canScoreProfessional = input(false);
  readonly changed = output<JudgeApplication>();

  protected readonly sections = JUDGE_SECTIONS;
  protected readonly professionalMax = PROFESSIONAL_MAX_SCORE;
  protected readonly draft = signal<Record<string, number | null>>({});
  protected readonly professional = signal<number | null>(null);
  protected readonly saving = signal<string | null>(null);
  protected readonly id = computed(() => this.application().id ?? 0);

  protected set(section: AssessmentSection, value: number | null): void {
    this.draft.update((draft) => ({ ...draft, [section]: value }));
  }

  protected valid(section: AssessmentSection, max: number): boolean {
    const value = this.draft()[section];

    return value !== null && value !== undefined && value >= 0 && value <= max;
  }

  protected saveSection(section: AssessmentSection, max: number): void {
    const score = this.draft()[section];

    if (!this.valid(section, max) || score === null || score === undefined) return;

    this.saving.set(section);
    this.api.documentScore(this.id(), { section, score }).subscribe({
      next: () => {
        this.saving.set(null);
        this.notify.success(this.lang.get('staff-assessment.scores.saved'));
      },
      error: () => this.saving.set(null),
    });
  }

  protected saveProfessional(): void {
    const score = this.professional();

    if (score === null) return;

    this.saving.set('PROFESSIONAL');
    this.api.professionalScore(this.id(), { score }).subscribe({
      next: (application) => {
        this.saving.set(null);
        this.notify.success(this.lang.get('staff-assessment.scores.saved'));
        this.changed.emit(application);
      },
      error: () => this.saving.set(null),
    });
  }
}
