import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { Skeleton } from 'primeng/skeleton';

import type { AssessmentSection, Schemas } from '@domain/api/api.types';
import { SettingsApi } from '@domain/api/settings.api';
import { NotifyService } from '@shared/ui/notify.service';

import { ASSESSMENT_SECTIONS } from '../assessment/assessment-rules';

type Weight = Schemas['SectionWeightResponse'];

interface Row {
  section: AssessmentSection;
  maxScore: number;
  appliesToCandidate: boolean;
  appliesToJudge: boolean;
  sortOrder: number | null;
}

/** Веса разделов оценки (`GET /weights`, `PUT /weights/{section}`): максимум баллов и к кому раздел применяется. */
@Component({
  selector: 'app-weights-tab',
  imports: [FormsModule, LangPipe, Button, Checkbox, InputNumber, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="mb-4 text-sm text-surface-500">{{ 'staff-directories.weights.hint' | lang }}</p>

    @if (loading()) {
      <p-skeleton height="20rem" borderRadius="0.75rem" />
    } @else {
      <div class="max-w-5xl overflow-x-auto rounded-xl border border-surface-200 bg-surface-0">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-surface-200 text-left text-xs tracking-wide text-surface-500 uppercase">
              <th class="px-4 py-3 font-medium">{{ 'staff-directories.weights.section' | lang }}</th>
              <th class="px-4 py-3 font-medium">{{ 'staff-directories.weights.max-score' | lang }}</th>
              <th class="px-4 py-3 font-medium">{{ 'staff-directories.weights.candidate' | lang }}</th>
              <th class="px-4 py-3 font-medium">{{ 'staff-directories.weights.judge' | lang }}</th>
              <th class="px-4 py-3 font-medium">{{ 'staff-directories.items.sort-order' | lang }}</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.section) {
              <tr class="border-b border-surface-100 last:border-b-0">
                <td class="px-4 py-2 font-medium">{{ 'staff-assessment.section.' + row.section | lang }}</td>
                <td class="px-4 py-2">
                  <p-inputnumber
                    styleClass="w-24"
                    [min]="0"
                    [max]="1000"
                    [useGrouping]="false"
                    [ariaLabel]="'staff-directories.weights.max-score' | lang"
                    [(ngModel)]="row.maxScore"
                  />
                </td>
                <td class="px-4 py-2">
                  <p-checkbox
                    [binary]="true"
                    [ariaLabel]="'staff-directories.weights.candidate' | lang"
                    [(ngModel)]="row.appliesToCandidate"
                  />
                </td>
                <td class="px-4 py-2">
                  <p-checkbox
                    [binary]="true"
                    [ariaLabel]="'staff-directories.weights.judge' | lang"
                    [(ngModel)]="row.appliesToJudge"
                  />
                </td>
                <td class="px-4 py-2">
                  <p-inputnumber
                    styleClass="w-20"
                    [min]="0"
                    [useGrouping]="false"
                    [ariaLabel]="'staff-directories.items.sort-order' | lang"
                    [(ngModel)]="row.sortOrder"
                  />
                </td>
                <td class="px-4 py-2 text-right">
                  <p-button
                    size="small"
                    icon="pi pi-save"
                    [label]="'shell.actions.save' | lang"
                    [loading]="busy() === row.section"
                    (onClick)="save(row)"
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class WeightsTabComponent implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<AssessmentSection | null>(null);

  ngOnInit(): void {
    this.api
      .weights()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (weights) => {
          this.rows.set(toRows(weights));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected save(row: Row): void {
    this.busy.set(row.section);
    this.api
      .updateWeight(row.section, {
        maxScore: row.maxScore,
        appliesToCandidate: row.appliesToCandidate,
        appliesToJudge: row.appliesToJudge,
        sortOrder: row.sortOrder ?? undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notify.success(this.lang.get('shell.form.saved'));
        },
        error: () => this.busy.set(null),
      });
  }
}

/** Все разделы в порядке `AssessmentSection`; не настроенные — с нулём и без применения. */
function toRows(weights: Weight[]): Row[] {
  const bySection = new Map(weights.map((weight) => [weight.section, weight]));

  return ASSESSMENT_SECTIONS.map((section) => {
    const weight = bySection.get(section);

    return {
      section,
      maxScore: weight?.maxScore ?? 0,
      appliesToCandidate: weight?.appliesToCandidate ?? false,
      appliesToJudge: weight?.appliesToJudge ?? false,
      sortOrder: weight?.sortOrder ?? null,
    };
  });
}
