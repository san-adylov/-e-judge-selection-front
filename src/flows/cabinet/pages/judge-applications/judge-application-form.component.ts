import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, input } from '@angular/core';
import { type AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import { LocalDatePipe } from '@shared/lib/format.pipes';

import { type ContestCard, type JudgeApplicationForm, PREFERRED_LANGUAGES } from './judge-application.model';

/**
 * Поля черновика `JudgeApplicationDraftRequest`. Выбор конкурса — только при создании (`contests` передан):
 * у существующего черновика конкурс не меняется, заявка привязана к нему.
 */
@Component({
  selector: 'app-judge-application-form',
  imports: [ReactiveFormsModule, LangPipe, LocalDatePipe, InputText, Select, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-1 gap-4 tablet:grid-cols-2" [formGroup]="form()">
      @if (contests(); as options) {
        <div class="flex flex-col gap-1 tablet:col-span-2">
          <label for="ja-contest" class="text-sm font-medium">
            {{ 'judge-applications.fields.contest' | lang }} <span class="text-red-600">*</span>
          </label>
          <p-select
            inputId="ja-contest"
            optionLabel="name"
            optionValue="id"
            appendTo="body"
            styleClass="w-full"
            formControlName="contestId"
            [filter]="options.length > 7"
            [options]="options"
            [placeholder]="'judge-applications.fields.contest-placeholder' | lang"
          >
            <ng-template #item let-contest>
              <div class="flex min-w-0 flex-col">
                <span class="truncate">{{ contest.name }}</span>
                <span class="text-xs text-surface-500">
                  {{ 'judge-applications.fields.acceptance-end' | lang }}:
                  {{ contest.documentAcceptanceEndDate | localDate }}
                </span>
              </div>
            </ng-template>
          </p-select>
          @if (invalid(form().controls.contestId)) {
            <small class="text-red-600">{{ 'judge-applications.errors.required' | lang }}</small>
          }
        </div>
      }

      <div class="flex flex-col gap-1">
        <label for="ja-language" class="text-sm font-medium">
          {{ 'judge-applications.fields.language' | lang }} <span class="text-red-600">*</span>
        </label>
        <p-select
          inputId="ja-language"
          optionLabel="label"
          optionValue="value"
          appendTo="body"
          styleClass="w-full"
          formControlName="preferredLanguage"
          [options]="languages()"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label for="ja-email" class="text-sm font-medium">{{ 'judge-applications.fields.email' | lang }}</label>
        <input pInputText id="ja-email" type="email" autocomplete="email" formControlName="email" />
        @if (invalid(form().controls.email)) {
          <small class="text-red-600">{{ 'judge-applications.errors.email' | lang }}</small>
        }
      </div>

      <div class="flex flex-col gap-1">
        <label for="ja-home-phone" class="text-sm font-medium">{{
          'judge-applications.fields.home-phone' | lang
        }}</label>
        <input pInputText id="ja-home-phone" type="tel" autocomplete="tel" formControlName="homePhone" />
        @if (invalid(form().controls.homePhone)) {
          <small class="text-red-600">{{ 'judge-applications.errors.max-length' | lang }}</small>
        }
      </div>

      <div class="flex flex-col gap-1">
        <label for="ja-work-phone" class="text-sm font-medium">{{
          'judge-applications.fields.work-phone' | lang
        }}</label>
        <input pInputText id="ja-work-phone" type="tel" formControlName="workPhone" />
        @if (invalid(form().controls.workPhone)) {
          <small class="text-red-600">{{ 'judge-applications.errors.max-length' | lang }}</small>
        }
      </div>

      <div class="flex flex-col gap-1 tablet:col-span-2">
        <label for="ja-home-address" class="text-sm font-medium">
          {{ 'judge-applications.fields.home-address' | lang }}
        </label>
        <textarea pTextarea id="ja-home-address" rows="2" formControlName="homeAddress"></textarea>
        @if (invalid(form().controls.homeAddress)) {
          <small class="text-red-600">{{ 'judge-applications.errors.max-length' | lang }}</small>
        }
      </div>

      <div class="flex flex-col gap-1 tablet:col-span-2">
        <label for="ja-contact-info" class="text-sm font-medium">
          {{ 'judge-applications.fields.contact-info' | lang }}
        </label>
        <textarea pTextarea id="ja-contact-info" rows="3" formControlName="contactInfo"></textarea>
        @if (invalid(form().controls.contactInfo)) {
          <small class="text-red-600">{{ 'judge-applications.errors.max-length' | lang }}</small>
        }
      </div>
    </div>
  `,
})
export class JudgeApplicationFormComponent {
  private readonly lang = inject(LangService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = input.required<JudgeApplicationForm>();
  /** Конкурсы для выбора; `null` — конкурс уже выбран, поле не показывается. */
  readonly contests = input<ContestCard[] | null>(null);

  protected readonly languages = computed(() => {
    this.lang.currentLang();

    return PREFERRED_LANGUAGES.map((value) => ({
      value,
      label: this.lang.get(`judge-applications.languages.${value}`),
    }));
  });

  constructor() {
    // `markAllAsTouched()` у родителя не помечает OnPush-потомка к проверке — подписываемся на события формы.
    effect((onCleanup) => {
      const subscription = this.form().events.subscribe(() => this.cdr.markForCheck());

      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected invalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }
}
