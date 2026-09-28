import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { map } from 'rxjs';

import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { DirectoryStore } from '@domain/stores/directory.store';
import { FileUploadComponent } from '@features/files/file-upload.component';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import {
  type Confirmation,
  type ConfirmationFormValue,
  type ConfirmationRequest,
  courtNameOf,
  courtOptions,
  FILE_FIELDS,
  isRangeInvalid,
  missingForSubmit,
  toFormValue,
  toRequest,
} from './judge-confirmation.logic';

/**
 * Форма заявки на подтверждение статуса (`JudgeConfirmationRequest`).
 * «Сохранить черновик» — `POST /active-judge-confirmations` (один черновик CREATED на пользователя),
 * «Отправить» — сохранение и `POST /{id}/submit` после подтверждения.
 */
@Component({
  selector: 'app-judge-confirmation-form',
  imports: [ReactiveFormsModule, LangPipe, Button, DatePicker, Select, FileUploadComponent, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirmation-form.component.html',
})
export class ConfirmationFormComponent {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly courtDirectory = inject(DirectoryStore).options('COURT_NAME');

  /** Черновик CREATED для редактирования или завершённая заявка, из которой берутся поля новой; `null` — пустая форма. */
  readonly source = input<Confirmation | null>(null);
  /** Форму можно закрыть (новая заявка после решения). */
  readonly cancellable = input(false);
  /** Заявка сохранена или отправлена: страница перечитывает состояние. */
  readonly changed = output<Confirmation>();
  readonly cancelled = output();

  protected readonly form = this.fb.group({
    courtId: this.fb.control<number | null>(null),
    workExperienceFrom: this.fb.control<Date | null>(null),
    workExperienceTo: this.fb.control<Date | null>(null),
    decreeFileId: this.fb.control<number | null>(null),
    assignmentFileId: this.fb.control<number | null>(null),
    qualificationFileId: this.fb.control<number | null>(null),
  });

  protected readonly busy = signal<'save' | 'submit' | null>(null);
  protected readonly submitted = signal(false);
  protected readonly today = new Date();
  protected readonly files = FILE_FIELDS;
  protected readonly courts = computed(() => courtOptions(this.courtDirectory(), this.source()));
  protected readonly isDraft = computed(() => this.source()?.status === 'CREATED');
  protected readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  private readonly missing = computed(() => new Set(missingForSubmit(this.value())));
  protected readonly rangeInvalid = computed(() =>
    isRangeInvalid(this.value().workExperienceFrom, this.value().workExperienceTo),
  );

  constructor() {
    effect(() => {
      const source = this.source();

      untracked(() => {
        this.form.reset(toFormValue(source));
        this.submitted.set(false);
      });
    });
  }

  /** Поле не заполнено, а пользователь уже пытался отправить заявку. */
  protected error(key: keyof ConfirmationFormValue): boolean {
    return this.submitted() && this.missing().has(key);
  }

  protected save(): void {
    if (this.rangeInvalid()) return;

    this.busy.set('save');
    this.api.createConfirmation(this.request()).subscribe({
      next: (draft) => {
        this.busy.set(null);
        this.notify.success(this.lang.get('judge-confirmation.toast.saved'));
        this.changed.emit(draft);
      },
      error: () => this.busy.set(null),
    });
  }

  protected submit(): void {
    this.submitted.set(true);

    if (this.missing().size > 0 || this.rangeInvalid()) return;

    this.confirm.confirm({
      header: this.lang.get('judge-confirmation.confirm.title'),
      message: this.lang.get('judge-confirmation.confirm.message'),
      acceptLabel: this.lang.get('judge-confirmation.confirm.accept'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.send(),
    });
  }

  /** Сначала сохраняет правки (бэкенд обновляет черновик CREATED), затем отправляет его секретарю. */
  private send(): void {
    this.busy.set('submit');
    this.api.createConfirmation(this.request()).subscribe({
      next: (draft) => {
        if (draft.id === undefined) {
          this.busy.set(null);
          this.changed.emit(draft);

          return;
        }

        this.api.submitConfirmation(draft.id).subscribe({
          next: (sent) => {
            this.busy.set(null);
            this.notify.success(this.lang.get('judge-confirmation.toast.submitted'));
            this.changed.emit(sent);
          },
          // Черновик уже сохранён — показываем его; причину отказа (например, 4137) покажет тост интерсептора.
          error: () => {
            this.busy.set(null);
            this.changed.emit(draft);
          },
        });
      },
      error: () => this.busy.set(null),
    });
  }

  private request(): ConfirmationRequest {
    const value = this.form.getRawValue();

    return toRequest(value, courtNameOf(value.courtId, this.courts(), this.source()));
  }
}
