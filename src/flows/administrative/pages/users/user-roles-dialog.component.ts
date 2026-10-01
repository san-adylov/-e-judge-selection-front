import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { MultiSelect } from 'primeng/multiselect';

import type { AuthRole, AuthSchemas } from '@domain/api/api.types';
import { UsersApi } from '@domain/api/users.api';
import { ROLES } from '@shared/auth/access-groups';
import { NotifyService } from '@shared/ui/notify.service';

type User = AuthSchemas['UserResponse'];

/** Замена набора ролей (`PUT /users/{id}/roles`): завершает все сессии пользователя. */
@Component({
  selector: 'app-user-roles-dialog',
  imports: [FormsModule, LangPipe, Button, Dialog, MultiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-lg mx-4"
      [modal]="true"
      [header]="'staff-users.roles.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <div class="flex flex-col gap-4">
        @if (user(); as user) {
          <p class="m-0 font-medium">{{ user.fullName || user.username }}</p>
        }
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium" for="roles-select">{{ 'staff-users.fields.roles' | lang }}</label>
          <p-multiselect
            inputId="roles-select"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            styleClass="w-full"
            display="chip"
            [options]="roleOptions()"
            [placeholder]="'shell.form.select' | lang"
            [ngModel]="roles()"
            (ngModelChange)="roles.set($event)"
          />
        </div>
        <p class="m-0 text-sm text-surface-500">{{ 'staff-users.roles.hint' | lang }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            icon="pi pi-save"
            [label]="'shell.actions.save' | lang"
            [loading]="saving()"
            [disabled]="!roles().length"
            (onClick)="submit()"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class UserRolesDialogComponent {
  private readonly api = inject(UsersApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly user = input<User | null>(null);
  readonly saved = output<User>();

  protected readonly saving = signal(false);
  protected readonly roles = signal<AuthRole[]>([]);
  protected readonly roleOptions = computed(() => {
    this.lang.currentLang();

    return ROLES.map((value) => ({ value, label: this.lang.get(`status.role.${value}`) }));
  });

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.roles.set([...(this.user()?.roles ?? [])]));
    });
  }

  protected submit(): void {
    const id = this.user()?.id;

    if (id === undefined || !this.roles().length) return;

    this.saving.set(true);
    this.api.changeRoles(id, this.roles()).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('shell.form.saved'));
        this.visible.set(false);
        this.saved.emit(user);
      },
      error: () => this.saving.set(false),
    });
  }
}
