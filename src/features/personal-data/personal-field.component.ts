import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { LangPipe } from '@reforgium/presentia';

import { fieldError } from './personal-data.form';

/**
 * Подпись, поле (через `ng-content`) и сообщение об ошибке. Ошибка пересчитывается по `control.events`,
 * потому что события проецируемого поля помечают «грязным» родителя, а не этот OnPush-компонент.
 */
@Component({
  selector: 'app-personal-field',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-1' },
  template: `
    <label class="text-sm font-medium" [for]="inputId()">
      {{ label() | lang }}
      @if (required()) {
        <span class="text-red-600">*</span>
      }
    </label>
    <ng-content />
    @if (hint() && !error()) {
      <small class="text-surface-500">{{ hint()! | lang }}</small>
    }
    @if (error(); as error) {
      <small class="text-red-600">{{ error.key | lang: error.params }}</small>
    }
  `,
})
export class PersonalFieldComponent {
  /** Ключ i18n подписи. */
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly control = input.required<AbstractControl>();
  readonly required = input(false);
  /** Ключ i18n подсказки под полем. */
  readonly hint = input<string | null>(null);

  private readonly version = signal(0);

  protected readonly error = computed(() => {
    this.version();

    return fieldError(this.control());
  });

  constructor() {
    effect((onCleanup) => {
      const subscription = this.control().events.subscribe(() => this.version.update((value) => value + 1));

      onCleanup(() => subscription.unsubscribe());
    });
  }
}
