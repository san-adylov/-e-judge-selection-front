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
import { Textarea } from 'primeng/textarea';

import type { Schemas } from '@domain/api/api.types';
import { ReserveApi } from '@domain/api/reserve.api';
import { DirectoryStore } from '@domain/stores/directory.store';
import { NotifyService } from '@shared/ui/notify.service';

type Reserve = Schemas['ReserveResponse'];

const COMMENT_MAX = 4000;

/** Исключение из резерва с основаниями из справочника `EXCLUSION_REASON` (`POST /candidate/reserve/{id}/exclude`). */
@Component({
  selector: 'app-reserve-exclude-dialog',
  imports: [FormsModule, LangPipe, Button, Dialog, MultiSelect, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-lg mx-4"
      [modal]="true"
      [header]="'staff-reserve.exclude.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <div class="flex flex-col gap-4">
        @if (reserve(); as item) {
          <p class="m-0 font-medium">{{ item.candidateFullName || '#' + item.candidateId }}</p>
        }
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium" for="exclude-reasons">
            {{ 'staff-reserve.exclude.reasons' | lang }} <span class="text-red-600" aria-hidden="true">*</span>
          </label>
          <p-multiselect
            inputId="exclude-reasons"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            styleClass="w-full"
            display="chip"
            [options]="reasons()"
            [placeholder]="'shell.form.select' | lang"
            [ngModel]="reasonIds()"
            (ngModelChange)="reasonIds.set($event)"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium" for="exclude-comment">{{ 'staff-reserve.exclude.comment' | lang }}</label>
          <textarea
            pTextarea
            id="exclude-comment"
            class="w-full"
            rows="4"
            [autoResize]="true"
            [maxlength]="commentMax"
            [ngModel]="comment()"
            (ngModelChange)="comment.set($event)"
          ></textarea>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button
            icon="pi pi-user-minus"
            severity="danger"
            [label]="'staff-reserve.actions.exclude' | lang"
            [loading]="saving()"
            [disabled]="!reasonIds().length"
            (onClick)="submit()"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class ReserveExcludeDialogComponent {
  private readonly api = inject(ReserveApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly reserve = input<Reserve | null>(null);
  readonly excluded = output<Reserve>();

  protected readonly commentMax = COMMENT_MAX;
  protected readonly reasons = inject(DirectoryStore).options('EXCLUSION_REASON');
  protected readonly reasonIds = signal<number[]>([]);
  protected readonly comment = signal('');
  protected readonly saving = signal(false);
  protected readonly valid = computed(() => this.reasonIds().length > 0);

  constructor() {
    effect(() => {
      if (this.visible()) {
        untracked(() => {
          this.reasonIds.set([]);
          this.comment.set('');
        });
      }
    });
  }

  protected submit(): void {
    const id = this.reserve()?.id;

    if (id === undefined || !this.valid()) return;

    this.saving.set(true);
    this.api.exclude(id, { reasonIds: this.reasonIds(), comment: this.comment().trim() || undefined }).subscribe({
      next: (reserve) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('staff-reserve.exclude.success'));
        this.visible.set(false);
        this.excluded.emit(reserve);
      },
      error: () => this.saving.set(false),
    });
  }
}
