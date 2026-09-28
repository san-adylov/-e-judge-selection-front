import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

@Component({
  selector: 'app-page-header',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="m-0 text-2xl font-semibold">{{ title() | lang }}</h1>
        @if (subtitle()) {
          <p class="m-0 mt-1 text-sm text-surface-500">{{ subtitle()! | lang }}</p>
        }
      </div>
      <ng-content />
    </div>
  `,
})
export class PageHeaderComponent {
  /** Ключ i18n. */
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
