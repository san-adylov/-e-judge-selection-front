import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { ToggleSwitch } from 'primeng/toggleswitch';

import type { Schemas } from '@domain/api/api.types';
import { SettingsApi } from '@domain/api/settings.api';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

/** Окно доступа кандидатов (`/schedule-settings`): часы по Бишкеку; смена — только SUPER_ADMIN. */
@Component({
  selector: 'app-schedule-tab',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    ServerDateTimePipe,
    Button,
    InputNumber,
    Message,
    Skeleton,
    ToggleSwitch,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p-skeleton height="14rem" borderRadius="0.75rem" />
    } @else {
      <form
        class="flex max-w-xl flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-5"
        [formGroup]="form"
        (ngSubmit)="submit()"
      >
        <p class="m-0 text-sm text-surface-500">{{ 'staff-directories.schedule.hint' | lang }}</p>
        @if (!canEdit) {
          <p-message severity="info" [text]="'staff-directories.schedule.readonly' | lang" />
        }
        <div class="grid grid-cols-2 gap-4">
          <app-form-field
            label="staff-directories.schedule.start-hour"
            inputId="sched-start"
            [required]="true"
            [control]="form.controls.startHour"
          >
            <p-inputnumber
              inputId="sched-start"
              styleClass="w-full"
              [min]="0"
              [max]="23"
              [useGrouping]="false"
              suffix=":00"
              formControlName="startHour"
            />
          </app-form-field>
          <app-form-field
            label="staff-directories.schedule.end-hour"
            inputId="sched-end"
            [required]="true"
            [control]="form.controls.endHour"
          >
            <p-inputnumber
              inputId="sched-end"
              styleClass="w-full"
              [min]="1"
              [max]="24"
              [useGrouping]="false"
              suffix=":00"
              formControlName="endHour"
            />
          </app-form-field>
        </div>
        <div class="flex items-center gap-2">
          <p-toggleswitch inputId="sched-unrestricted" formControlName="unrestrictedAccess" />
          <label for="sched-unrestricted" class="text-sm font-medium">{{
            'staff-directories.schedule.unrestricted' | lang
          }}</label>
        </div>
        @if (updatedAt(); as updatedAt) {
          <span class="text-xs text-surface-500"
            >{{ 'staff-directories.schedule.updated' | lang }} {{ updatedAt | serverDateTime }}</span
          >
        }
        @if (canEdit) {
          <p-button
            class="self-end"
            type="submit"
            icon="pi pi-save"
            [label]="'shell.actions.save' | lang"
            [loading]="saving()"
          />
        }
      </form>
    }
  `,
})
export class ScheduleTabComponent implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canEdit = inject(SessionService).can('SUPER_ADMIN');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly updatedAt = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    startHour: [9, [Validators.required, Validators.min(0), Validators.max(23)]],
    endHour: [18, [Validators.required, Validators.min(1), Validators.max(24)]],
    unrestrictedAccess: [false],
  });

  ngOnInit(): void {
    if (!this.canEdit) this.form.disable();

    this.api
      .scheduleSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings) => {
          this.apply(settings);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    this.api.updateScheduleSettings(this.form.getRawValue()).subscribe({
      next: (settings) => {
        this.saving.set(false);
        this.apply(settings);
        this.notify.success(this.lang.get('shell.form.saved'));
      },
      error: () => this.saving.set(false),
    });
  }

  private apply(settings: Schemas['ScheduleSettingsResponse']): void {
    this.form.reset({
      startHour: settings.startHour ?? 9,
      endHour: settings.endHour ?? 18,
      unrestrictedAccess: settings.unrestrictedAccess ?? false,
    });
    this.updatedAt.set(settings.updatedAt ?? null);
  }
}
