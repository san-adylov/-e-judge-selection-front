import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Tag } from 'primeng/tag';

import { type RatingEntry, type RatingOutcome, ratingOutcome } from './score-breakdown';

const SEVERITY: Record<RatingOutcome, 'success' | 'info' | 'danger'> = {
  reserve: 'success',
  passed: 'info',
  failed: 'danger',
};

/** Метка исхода по строке рейтинга: «В резерве» / «Прошёл, срок резерва истёк» / «Не прошёл». */
@Component({
  selector: 'app-rating-outcome-tag',
  imports: [LangPipe, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p-tag [severity]="severity()" [value]="'results.outcome.' + outcome() | lang" />`,
})
export class RatingOutcomeTagComponent {
  readonly entry = input.required<Pick<RatingEntry, 'passed' | 'reserveExpired'>>();

  protected readonly outcome = computed(() => ratingOutcome(this.entry()));
  protected readonly severity = computed(() => SEVERITY[this.outcome()]);
}
