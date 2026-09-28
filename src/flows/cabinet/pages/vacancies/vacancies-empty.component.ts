import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';

/** Пустой список: вакансии предлагаются только кандидатам из резерва судей — ссылка на резерв. */
@Component({
  selector: 'app-vacancies-empty',
  imports: [RouterLink, LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-300 bg-surface-0 p-6 text-center tablet:p-8"
    >
      <i class="pi pi-briefcase text-3xl text-surface-400"></i>
      <p class="m-0 font-semibold">{{ 'vacancies.empty.' + kind() + '.title' | lang }}</p>
      <p class="m-0 max-w-xl text-sm text-surface-500">
        {{ 'vacancies.empty.' + kind() + (inReserve() ? '.in-reserve' : '.no-reserve') | lang }}
      </p>
      <a class="text-sm text-primary hover:underline" routerLink="/cabinet/reserve">
        {{ 'vacancies.empty.reserve-link' | lang }}
      </a>
    </div>
  `,
})
export class VacanciesEmptyComponent {
  readonly kind = input.required<'available' | 'applications'>();
  /** Есть действующая позиция в резерве судей. */
  readonly inReserve = input(false);
}
