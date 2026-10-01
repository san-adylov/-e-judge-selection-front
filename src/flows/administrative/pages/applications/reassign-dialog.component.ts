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
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';

import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { UsersApi } from '@domain/api/users.api';
import { NotifyService } from '@shared/ui/notify.service';

import type { Application } from './application-rules';

interface Option {
  value: number;
  label: string;
}

/**
 * Смена докладчика председателем (`PUT /contest-application/assign-board-member/{id}?boardMemberId`).
 * Кандидаты — активные члены Совета из `GET /users/board-members?activeOnly=true` (доступно председателю).
 */
@Component({
  selector: 'app-application-reassign-dialog',
  imports: [FormsModule, LangPipe, Button, Dialog, Message, Select, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-lg mx-4"
      [modal]="true"
      [header]="'staff-applications.reassign.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <div class="flex flex-col gap-4">
        @if (loading()) {
          <p-skeleton height="2.75rem" />
        } @else if (!options().length) {
          <p-message
            severity="warn"
            icon="pi pi-exclamation-triangle"
            [text]="'staff-applications.reassign.empty' | lang"
          />
        } @else {
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium" for="reassign-member">{{
              'staff-applications.reassign.member' | lang
            }}</label>
            <p-select
              inputId="reassign-member"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              styleClass="w-full"
              [filter]="options().length > 8"
              [options]="options()"
              [placeholder]="'shell.form.select' | lang"
              [ngModel]="selected()"
              (ngModelChange)="selected.set($event)"
            />
          </div>
        }
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            icon="pi pi-user-edit"
            [label]="'staff-applications.actions.reassign' | lang"
            [loading]="saving()"
            [disabled]="selected() === null || selected() === currentReporterId()"
            (onClick)="submit()"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class ApplicationReassignDialogComponent {
  private readonly api = inject(ContestApplicationApi);
  private readonly users = inject(UsersApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly applicationId = input.required<number>();
  readonly currentReporterId = input<number | null | undefined>(null);
  readonly visible = model(false);
  readonly reassigned = output<Application>();

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly options = signal<Option[]>([]);
  protected readonly selected = signal<number | null>(null);

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.open());
    });
  }

  protected submit(): void {
    const boardMemberId = this.selected();

    if (boardMemberId === null) return;

    this.saving.set(true);
    this.api.assignBoardMember(this.applicationId(), boardMemberId).subscribe({
      next: (application) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('staff-applications.reassign.success'));
        this.visible.set(false);
        this.reassigned.emit(application);
      },
      error: () => this.saving.set(false),
    });
  }

  private open(): void {
    this.selected.set(this.currentReporterId() ?? null);
    this.loading.set(true);
    this.users.boardMembers(true).subscribe({
      next: (members) => {
        this.options.set(
          members
            .filter((member) => member.id !== undefined)
            .map((member) => ({ value: member.id as number, label: member.fullName || `#${member.id}` })),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
