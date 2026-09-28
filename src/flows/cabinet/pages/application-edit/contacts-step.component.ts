import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import { DRAFT_LANGUAGES, type DraftForm } from '@features/application-draft/draft-form';

/** Шаг 1: контакты и язык взаимодействия — поля `ApplicationDraftRequest`. */
@Component({
  selector: 'app-contacts-step',
  imports: [ReactiveFormsModule, LangPipe, InputText, Message, Select, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <p class="m-0 text-sm text-surface-600">{{ 'wizard.contacts.hint' | lang }}</p>

      @if (locked()) {
        <p-message severity="info" [text]="'wizard.contacts.locked' | lang" />
      }

      <form class="grid grid-cols-1 gap-4 tablet:grid-cols-2" [formGroup]="form()">
        <div class="flex flex-col gap-1">
          <label for="draft-language" class="text-sm font-medium">{{ 'wizard.contacts.language' | lang }}</label>
          <p-select
            inputId="draft-language"
            formControlName="preferredLanguage"
            styleClass="w-full"
            [options]="languages()"
            [showClear]="true"
            [placeholder]="'wizard.contacts.language-placeholder' | lang"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="draft-email" class="text-sm font-medium">{{ 'wizard.contacts.email' | lang }}</label>
          <input pInputText id="draft-email" type="email" autocomplete="email" formControlName="email" />
          @if (invalid('email')) {
            <small class="text-red-600">{{ 'wizard.contacts.email-invalid' | lang }}</small>
          }
        </div>

        <div class="flex flex-col gap-1">
          <label for="draft-home-phone" class="text-sm font-medium">{{ 'wizard.contacts.home-phone' | lang }}</label>
          <input pInputText id="draft-home-phone" type="tel" autocomplete="tel" formControlName="homePhone" />
          @if (invalid('homePhone')) {
            <small class="text-red-600">{{ 'wizard.contacts.too-long' | lang: { max: 32 } }}</small>
          }
        </div>

        <div class="flex flex-col gap-1">
          <label for="draft-work-phone" class="text-sm font-medium">{{ 'wizard.contacts.work-phone' | lang }}</label>
          <input pInputText id="draft-work-phone" type="tel" formControlName="workPhone" />
          @if (invalid('workPhone')) {
            <small class="text-red-600">{{ 'wizard.contacts.too-long' | lang: { max: 32 } }}</small>
          }
        </div>

        <div class="flex flex-col gap-1 tablet:col-span-2">
          <label for="draft-address" class="text-sm font-medium">{{ 'wizard.contacts.home-address' | lang }}</label>
          <textarea pTextarea id="draft-address" rows="2" class="w-full" formControlName="homeAddress"></textarea>
          @if (invalid('homeAddress')) {
            <small class="text-red-600">{{ 'wizard.contacts.too-long' | lang: { max: 1000 } }}</small>
          }
        </div>

        <div class="flex flex-col gap-1 tablet:col-span-2">
          <label for="draft-contact-info" class="text-sm font-medium">{{
            'wizard.contacts.contact-info' | lang
          }}</label>
          <textarea pTextarea id="draft-contact-info" rows="3" class="w-full" formControlName="contactInfo"></textarea>
          <small class="text-surface-500">{{ 'wizard.contacts.contact-info-hint' | lang }}</small>
          @if (invalid('contactInfo')) {
            <small class="text-red-600">{{ 'wizard.contacts.too-long' | lang: { max: 1000 } }}</small>
          }
        </div>
      </form>
    </div>
  `,
})
export class ContactsStepComponent {
  private readonly lang = inject(LangService);

  readonly form = input.required<DraftForm>();
  /** Заявка возвращена на доработку: контакты не меняются (бэкенд — 4013). */
  readonly locked = input(false);

  private readonly labels = DRAFT_LANGUAGES.map((value) => ({
    value,
    label: this.lang.observe(`wizard.language.${value}`),
  }));

  protected readonly languages = computed(() => this.labels.map(({ value, label }) => ({ value, label: label() })));

  protected invalid(key: keyof DraftForm['controls']): boolean {
    const control = this.form().controls[key];

    return control.invalid && (control.touched || control.dirty);
  }
}
