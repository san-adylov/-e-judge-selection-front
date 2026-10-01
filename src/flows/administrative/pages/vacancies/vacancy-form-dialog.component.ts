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
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { VacanciesApi } from '@domain/api/vacancies.api';
import { parseLocalDate, toLocalDate, toServerDateTime } from '@shared/lib/dates';
import { dateRangeValidator } from '@shared/lib/validators';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

import type { Vacancy } from './vacancy-rules';

type Contest = Schemas['ContestResponse'];

/**
 * Вакансия: создание председателем (`POST /vacancy`, вместе с заседанием об объявлении — `meetingStartDateTime`
 * обязателен) и правка секретарём (`PATCH /vacancy/{id}`, пока черновик или готова к публикации).
 */
@Component({
  selector: 'app-vacancy-form-dialog',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    Button,
    DatePicker,
    Dialog,
    InputNumber,
    InputText,
    Select,
    Textarea,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vacancy-form-dialog.component.html',
})
export class VacancyFormDialogComponent {
  private readonly api = inject(VacanciesApi);
  private readonly contestApi = inject(ContestApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  /** `null` — создание. */
  readonly vacancy = input<Vacancy | null>(null);
  readonly saved = output<Vacancy>();

  protected readonly now = new Date();
  protected readonly saving = signal(false);
  protected readonly contests = signal<Contest[]>([]);
  protected readonly contestsLoading = signal(false);
  protected readonly editing = computed(() => this.vacancy() !== null);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      contestId: [null as number | null, Validators.required],
      name: ['', [Validators.required, Validators.maxLength(500)]],
      description: ['', Validators.maxLength(4000)],
      quantity: [1 as number | null, [Validators.required, Validators.min(1)]],
      startDate: [null as Date | null, Validators.required],
      endDate: [null as Date | null, Validators.required],
      meetingStart: [null as Date | null],
    },
    { validators: dateRangeValidator('startDate', 'endDate') },
  );

  /** Вакансия объявляется по завершённому конкурсу, пока его участники не отобраны. */
  protected readonly contestOptions = computed(() =>
    this.contests()
      .filter((contest) => contest.id !== undefined && contest.participantSelection !== 'SELECTED')
      .map((contest) => ({ value: contest.id as number, label: contest.name || `#${contest.id}` })),
  );

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.open());
    });
  }

  protected submit(): void {
    const vacancy = this.vacancy();
    const value = this.form.getRawValue();
    const creating = vacancy === null;

    if (this.form.invalid || (creating && !value.meetingStart)) {
      this.form.markAllAsTouched();

      return;
    }

    const body: Schemas['VacancyRequest'] = {
      contestId: value.contestId ?? vacancy?.contestId ?? 0,
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      quantity: value.quantity ?? undefined,
      startDate: toLocalDate(value.startDate!),
      endDate: toLocalDate(value.endDate!),
      fileIds: vacancy?.fileIds,
      meetingStartDateTime: creating && value.meetingStart ? toServerDateTime(value.meetingStart) : undefined,
    };
    const request = creating ? this.api.create(body) : this.api.update(vacancy.id ?? 0, body);

    this.saving.set(true);
    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.notify.success(this.lang.get(creating ? 'staff-vacancies.form.created' : 'shell.form.saved'));
        this.visible.set(false);
        this.saved.emit(result);
      },
      error: () => this.saving.set(false),
    });
  }

  private open(): void {
    const vacancy = this.vacancy();

    this.form.reset({
      contestId: vacancy?.contestId ?? null,
      name: vacancy?.name ?? '',
      description: vacancy?.description ?? '',
      quantity: vacancy?.quantity ?? 1,
      startDate: parseLocalDate(vacancy?.startDate),
      endDate: parseLocalDate(vacancy?.endDate),
      meetingStart: null,
    });

    if (vacancy) {
      this.form.controls.contestId.disable();

      return;
    }

    this.form.controls.contestId.enable();
    this.contestsLoading.set(true);
    this.contestApi.completed({ size: 200 }).subscribe({
      next: (result) => {
        this.contests.set(result.content);
        this.contestsLoading.set(false);
      },
      error: () => this.contestsLoading.set(false),
    });
  }
}
