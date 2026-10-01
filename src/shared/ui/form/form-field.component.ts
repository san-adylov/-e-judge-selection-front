import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { LangPipe } from '@reforgium/presentia';

import { formFieldError } from './form-errors';

/**
 * Поле формы сотрудника: подпись, само поле (через `ng-content`) и ошибка `shell.form.*`.
 * Ошибка пересчитывается по `control.events`: события проецируемого поля помечают «грязным» родителя,
 * а не этот OnPush-компонент.
 *
 * ```html
 * <app-form-field label="staff-contests.form.name" inputId="name" [required]="true" [control]="form.controls.name">
 *   <input pInputText id="name" formControlName="name" />
 * </app-form-field>
 * ```
 */
@Component({
  selector: 'app-form-field',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-col gap-1' },
  template: `
    <label class="text-sm font-medium" [for]="inputId()">
      {{ label() | lang }}
      @if (required()) {
        <span class="text-red-600" aria-hidden="true">*</span>
      }
    </label>
    <ng-content />
    @if (error(); as error) {
      <small class="text-red-600">{{ error.key | lang: error.params }}</small>
    } @else if (hint()) {
      <small class="text-surface-500">{{ hint()! | lang }}</small>
    }
  `,
})
export class FormFieldComponent {
  /** Ключ i18n подписи. */
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  /** Без контрола (например, составное поле) ошибка не показывается. */
  readonly control = input<AbstractControl | null>(null);
  readonly required = input(false);
  /** Ключ i18n подсказки под полем. */
  readonly hint = input<string | null>(null);

  private readonly version = signal(0);

  protected readonly error = computed(() => {
    this.version();

    const control = this.control();

    return control ? formFieldError(control) : null;
  });

  constructor() {
    effect((onCleanup) => {
      const control = this.control();

      if (!control) return;

      const subscription = control.events.subscribe(() => this.version.update((value) => value + 1));

      onCleanup(() => subscription.unsubscribe());
    });
  }
}
