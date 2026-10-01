import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Select } from 'primeng/select';

import type { AuthRole, AuthSchemas } from '@domain/api/api.types';
import { AuthApi } from '@domain/api/auth.api';
import { ROLES } from '@shared/auth/access-groups';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

type User = AuthSchemas['UserResponse'];

/** Роли, которые назначают через интерфейс: кандидаты и судьи приходят через ЕСИА и подтверждение статуса. */
export const STAFF_ROLES: readonly AuthRole[] = ROLES.filter((role) => role !== 'CANDIDATE' && role !== 'ACTIVE_JUDGE');

/** Регистрация сотрудника с паролем (`POST /auth/register`). */
@Component({
  selector: 'app-user-create-dialog',
  imports: [ReactiveFormsModule, LangPipe, Button, Dialog, InputText, Password, Select, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-xl mx-4"
      [modal]="true"
      [header]="'staff-users.create.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <div class="grid grid-cols-1 gap-4 tablet:grid-cols-3">
          <app-form-field
            label="staff-users.fields.last-name"
            inputId="u-last"
            [required]="true"
            [control]="form.controls.lastName"
          >
            <input pInputText id="u-last" class="w-full" formControlName="lastName" />
          </app-form-field>
          <app-form-field
            label="staff-users.fields.first-name"
            inputId="u-first"
            [required]="true"
            [control]="form.controls.firstName"
          >
            <input pInputText id="u-first" class="w-full" formControlName="firstName" />
          </app-form-field>
          <app-form-field
            label="staff-users.fields.middle-name"
            inputId="u-middle"
            [control]="form.controls.middleName"
          >
            <input pInputText id="u-middle" class="w-full" formControlName="middleName" />
          </app-form-field>
        </div>
        <div class="grid grid-cols-1 gap-4 tablet:grid-cols-2">
          <app-form-field
            label="staff-users.fields.pin"
            inputId="u-pin"
            [required]="true"
            [control]="form.controls.pin"
            hint="staff-users.create.pin-hint"
          >
            <input pInputText id="u-pin" class="w-full" inputmode="numeric" maxlength="14" formControlName="pin" />
          </app-form-field>
          <app-form-field
            label="staff-users.fields.role"
            inputId="u-role"
            [required]="true"
            [control]="form.controls.role"
          >
            <p-select
              inputId="u-role"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              styleClass="w-full"
              [options]="roleOptions()"
              formControlName="role"
            />
          </app-form-field>
          <app-form-field
            label="staff-users.fields.username"
            inputId="u-username"
            [required]="true"
            [control]="form.controls.username"
          >
            <input pInputText id="u-username" class="w-full" autocomplete="off" formControlName="username" />
          </app-form-field>
          <app-form-field
            label="staff-users.fields.password"
            inputId="u-password"
            [required]="true"
            [control]="form.controls.password"
            hint="staff-users.create.password-hint"
          >
            <p-password
              inputId="u-password"
              styleClass="w-full"
              inputStyleClass="w-full"
              autocomplete="new-password"
              [feedback]="false"
              [toggleMask]="true"
              formControlName="password"
            />
          </app-form-field>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            type="submit"
            icon="pi pi-user-plus"
            [label]="'staff-users.create.action' | lang"
            [loading]="saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
})
export class UserCreateDialogComponent {
  private readonly api = inject(AuthApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly created = output<User>();

  protected readonly saving = signal(false);
  protected readonly roleOptions = computed(() => {
    this.lang.currentLang();

    return STAFF_ROLES.map((value) => ({ value, label: this.lang.get(`status.role.${value}`) }));
  });

  protected readonly form = this.fb.nonNullable.group({
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    middleName: ['', Validators.maxLength(100)],
    pin: ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
    role: ['SECRETARY' as AuthRole, Validators.required],
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(64)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.form.reset());
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();

    this.saving.set(true);
    this.api
      .register({
        username: value.username.trim(),
        password: value.password,
        pin: value.pin.trim(),
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        middleName: value.middleName.trim() || undefined,
        role: value.role,
      })
      .subscribe({
        next: (user) => {
          this.saving.set(false);
          this.notify.success(this.lang.get('staff-users.create.success'));
          this.visible.set(false);
          this.created.emit(user);
        },
        error: () => this.saving.set(false),
      });
  }
}
