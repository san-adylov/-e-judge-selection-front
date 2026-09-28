import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Skeleton } from 'primeng/skeleton';

import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';

import { type JudgeScores, scoreTiles } from './judge-application.model';

/** Баллы судьи и результат профессиональной оценки: `GET /judge-applications/{id}/my/scores`. */
@Component({
  selector: 'app-judge-application-scores',
  imports: [DecimalPipe, LangPipe, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="grid grid-cols-1 gap-3 tablet:grid-cols-3">
        <p-skeleton height="4.5rem" />
        <p-skeleton height="4.5rem" />
      </div>
    } @else if (tiles().length) {
      <div class="grid grid-cols-1 gap-3 tablet:grid-cols-3">
        @for (tile of tiles(); track tile.key) {
          <div class="flex flex-col gap-1 rounded-lg border border-surface-200 bg-surface-50 p-3">
            <span class="text-sm text-surface-500">{{ 'judge-applications.scores.' + tile.key | lang }}</span>
            <span class="text-xl font-semibold">
              {{ tile.value === null ? '—' : (tile.value | number: '1.0-2') }}
            </span>
          </div>
        }
      </div>
    } @else {
      <p class="m-0 text-sm text-surface-500">{{ 'judge-applications.scores.empty' | lang }}</p>
    }
  `,
})
export class JudgeApplicationScoresComponent {
  private readonly api = inject(JudgeApplicationsApi);

  readonly applicationId = input.required<number>();
  /** Смена статуса — повод перечитать баллы. */
  readonly status = input<string | null | undefined>(null);

  protected readonly loading = signal(true);
  private readonly scores = signal<JudgeScores | null>(null);
  protected readonly tiles = computed(() => scoreTiles(this.scores()));

  constructor() {
    effect(() => {
      const id = this.applicationId();

      this.status();
      untracked(() => this.load(id));
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.api.myScores(id).subscribe({
      next: (scores) => {
        this.scores.set(scores);
        this.loading.set(false);
      },
      error: () => {
        this.scores.set(null);
        this.loading.set(false);
      },
    });
  }
}
