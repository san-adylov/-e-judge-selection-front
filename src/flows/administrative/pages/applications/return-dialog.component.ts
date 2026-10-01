import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Textarea } from 'primeng/textarea';

import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

import { type Application, RETURN_REASON_MAX } from './application-rules';

/** Возврат заявки кандидату на доработку с причиной (`PUT /contest-application/returned-for-correction/{id}`). */
@Component({
  selector: 'app-application-return-dialog',
  imports: [ReactiveFormsModule, LangPipe, Button, Dialog, Textarea, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-xl mx-4"
      [modal]="true"
      [header]="'staff-applications.return.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <p class="m-0 text-sm text-surface-600">{{ 'staff-applications.return.hint' | lang }}</p>
        <app-form-field
          label="staff-applications.return.reason"
          inputId="return-reason"
          [required]="true"
          [control]="form.controls.reason"
        >
          <textarea
            pTextarea
            id="return-reason"
            class="w-full"
            rows="6"
            [autoResize]="true"
            [maxlength]="reasonMax"
            formControlName="reason"
          ></textarea>
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
            icon="pi pi-undo"
            severity="warn"
            [label]="'staff-applications.actions.return' | lang"
            [loading]="saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
})
export class ApplicationReturnDialogComponent {
  private readonly api = inject(ContestApplicationApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly applicationId = input.required<number>();
  readonly visible = model(false);
  readonly returned = output<Application>();

  protected readonly reasonMax = RETURN_REASON_MAX;
  protected readonly saving = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(RETURN_REASON_MAX)]],
  });

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.form.reset());
    });
  }

  protected submit(): void {
    const reason = this.form.controls.reason.value.trim();

    if (this.form.invalid || !reason) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    this.api.returnForCorrection(this.applicationId(), { reason }).subscribe({
      next: (application) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('staff-applications.return.success'));
        this.visible.set(false);
        this.returned.emit(application);
      },
      error: () => this.saving.set(false),
    });
  }
}
