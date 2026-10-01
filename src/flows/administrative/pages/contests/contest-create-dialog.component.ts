import { ChangeDetectionStrategy, Component, effect, inject, model, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';

import { ContestApi } from '@domain/api/contest.api';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

import { NAME_MAX } from './contest-form';
import type { Contest } from './contest-rules';

/**
 * Создание конкурса председателем: только название (`POST /contest/create-name`), остальное заполняет
 * секретарь перед публикацией. Созданный конкурс — в статусе `CREATED`, следующий шаг — заседание об открытии.
 */
@Component({
  selector: 'app-contest-create-dialog',
  imports: [ReactiveFormsModule, LangPipe, Button, Dialog, InputText, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-lg mx-4"
      [modal]="true"
      [header]="'staff-contests.create.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <p class="m-0 text-sm text-surface-600">{{ 'staff-contests.create.hint' | lang }}</p>
        <app-form-field
          label="staff-contests.form.name"
          inputId="contest-create-name"
          [required]="true"
          [control]="form.controls.name"
        >
          <input
            pInputText
            id="contest-create-name"
            class="w-full"
            autocomplete="off"
            [maxlength]="nameMax"
            formControlName="name"
          />
        </app-form-field>
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            type="submit"
            icon="pi pi-plus"
            [label]="'staff-contests.create.submit' | lang"
            [loading]="saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
})
export class ContestCreateDialogComponent {
  private readonly api = inject(ContestApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly created = output<Contest>();

  protected readonly nameMax = NAME_MAX;
  protected readonly saving = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(NAME_MAX)]],
  });

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.form.reset());
    });
  }

  protected submit(): void {
    const name = this.form.controls.name.value.trim();

    if (this.form.invalid || !name) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    this.api.createName({ name }).subscribe({
      next: (contest) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('staff-contests.create.success'));
        this.visible.set(false);
        this.created.emit(contest);
      },
      error: () => this.saving.set(false),
    });
  }
}
