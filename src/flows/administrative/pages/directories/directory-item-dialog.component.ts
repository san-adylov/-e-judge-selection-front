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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import type { DirectoryCode, Schemas } from '@domain/api/api.types';
import { DirectoryApi } from '@domain/api/directory.api';
import { DirectoryStore } from '@domain/stores/directory.store';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

import { PARENT_CODE } from './directory-rules';

type Item = Schemas['DirectoryItemResponse'];

/** Запись локального справочника: код, названия, родитель (для иерархических), порядок (`POST|PUT /directory/{code}`). */
@Component({
  selector: 'app-directory-item-dialog',
  imports: [ReactiveFormsModule, LangPipe, Button, Dialog, InputNumber, InputText, Select, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-xl mx-4"
      [modal]="true"
      [header]="(item() ? 'staff-directories.items.edit-title' : 'staff-directories.items.create-title') | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <app-form-field
          label="staff-directories.items.name-ru"
          inputId="dir-name-ru"
          [required]="true"
          [control]="form.controls.nameRu"
        >
          <input pInputText id="dir-name-ru" class="w-full" formControlName="nameRu" />
        </app-form-field>
        <app-form-field label="staff-directories.items.name-kg" inputId="dir-name-kg" [control]="form.controls.nameKg">
          <input pInputText id="dir-name-kg" class="w-full" formControlName="nameKg" />
        </app-form-field>
        <div class="grid grid-cols-1 gap-4 tablet:grid-cols-2">
          <app-form-field label="staff-directories.items.code" inputId="dir-code" [control]="form.controls.code">
            <input pInputText id="dir-code" class="w-full" formControlName="code" />
          </app-form-field>
          <app-form-field
            label="staff-directories.items.sort-order"
            inputId="dir-sort"
            [control]="form.controls.sortOrder"
          >
            <p-inputnumber
              inputId="dir-sort"
              styleClass="w-full"
              [min]="0"
              [useGrouping]="false"
              formControlName="sortOrder"
            />
          </app-form-field>
        </div>
        @if (parentCode(); as parent) {
          <app-form-field
            label="staff-directories.items.parent"
            inputId="dir-parent"
            [control]="form.controls.parentId"
          >
            <p-select
              inputId="dir-parent"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              styleClass="w-full"
              [filter]="true"
              [showClear]="true"
              [options]="parentOptions()"
              [placeholder]="'staff-directories.code.' + parent | lang"
              formControlName="parentId"
            />
          </app-form-field>
        }
        <div class="flex flex-wrap justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'shell.actions.cancel' | lang"
            (onClick)="visible.set(false)"
          />
          <p-button type="submit" icon="pi pi-save" [label]="'shell.actions.save' | lang" [loading]="saving()" />
        </div>
      </form>
    </p-dialog>
  `,
})
export class DirectoryItemDialogComponent {
  private readonly api = inject(DirectoryApi);
  private readonly store = inject(DirectoryStore);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly code = input.required<DirectoryCode>();
  readonly item = input<Item | null>(null);
  readonly saved = output<Item>();

  protected readonly saving = signal(false);
  protected readonly parentCode = computed(() => PARENT_CODE[this.code()] ?? null);
  protected readonly parentOptions = computed(() => {
    const parent = this.parentCode();

    return parent ? this.store.options(parent)() : [];
  });

  protected readonly form = this.fb.nonNullable.group({
    nameRu: ['', [Validators.required, Validators.maxLength(500)]],
    nameKg: ['', Validators.maxLength(500)],
    code: ['', Validators.maxLength(100)],
    sortOrder: [null as number | null],
    parentId: [null as number | null],
  });

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.open());
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();
    const body: Schemas['DirectoryItemRequest'] = {
      nameRu: value.nameRu.trim(),
      nameKg: value.nameKg.trim() || undefined,
      code: value.code.trim() || undefined,
      sortOrder: value.sortOrder ?? undefined,
      parentId: value.parentId ?? undefined,
    };
    const id = this.item()?.id;
    const code = this.code();
    const request = id === undefined ? this.api.create(code, body) : this.api.update(code, id, body);

    this.saving.set(true);
    request.subscribe({
      next: (item) => {
        this.saving.set(false);
        this.store.invalidate(code);
        this.notify.success(this.lang.get('shell.form.saved'));
        this.visible.set(false);
        this.saved.emit(item);
      },
      error: () => this.saving.set(false),
    });
  }

  private open(): void {
    const item = this.item();

    this.form.reset({
      nameRu: item?.nameRu ?? '',
      nameKg: item?.nameKg ?? '',
      code: item?.code ?? '',
      sortOrder: item?.sortOrder ?? null,
      parentId: item?.parentId ?? null,
    });
  }
}
