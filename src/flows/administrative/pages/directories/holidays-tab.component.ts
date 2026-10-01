import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';

import type { Schemas } from '@domain/api/api.types';
import { SettingsApi } from '@domain/api/settings.api';
import { parseLocalDate, toLocalDate } from '@shared/lib/dates';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { localized } from '@shared/lib/language';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

type Holiday = Schemas['HolidayResponse'];

/** Праздничные дни: список, добавление и правка, удаление (`/holidays`). Ежегодные повторяются по дате. */
@Component({
  selector: 'app-holidays-tab',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    LocalDatePipe,
    Button,
    Checkbox,
    DatePicker,
    Dialog,
    InputText,
    Skeleton,
    Tag,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './holidays-tab.component.html',
})
export class HolidaysTabComponent implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<Holiday[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly editing = signal(false);
  protected readonly selected = signal<Holiday | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    date: [null as Date | null, Validators.required],
    nameRu: ['', [Validators.required, Validators.maxLength(255)]],
    nameKg: ['', Validators.maxLength(255)],
    recurring: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  protected name(item: Holiday): string {
    return localized(item.nameRu, item.nameKg, this.lang.currentLang());
  }

  protected open(item: Holiday | null): void {
    this.selected.set(item);
    this.form.reset({
      date: parseLocalDate(item?.date),
      nameRu: item?.nameRu ?? '',
      nameKg: item?.nameKg ?? '',
      recurring: item?.recurring ?? true,
    });
    this.editing.set(true);
  }

  protected submit(): void {
    const date = this.form.controls.date.value;

    if (this.form.invalid || !date) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();
    const body: Schemas['HolidayRequest'] = {
      date: toLocalDate(date),
      nameRu: value.nameRu.trim(),
      nameKg: value.nameKg.trim() || undefined,
      recurring: value.recurring,
    };
    const id = this.selected()?.id;
    const request = id === undefined ? this.api.createHoliday(body) : this.api.updateHoliday(id, body);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.notify.success(this.lang.get('shell.form.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(item: Holiday): void {
    const id = item.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('staff-directories.holidays.delete-title'),
      message: this.lang.get('staff-directories.holidays.delete-message', { name: this.name(item) }),
      icon: 'pi pi-trash',
      acceptLabel: this.lang.get('shell.actions.delete'),
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.busy.set(id);
        this.api.removeHoliday(id).subscribe({
          next: () => {
            this.busy.set(null);
            this.items.update((items) => items.filter((row) => row.id !== id));
          },
          error: () => this.busy.set(null),
        });
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .holidays()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set([...items].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
