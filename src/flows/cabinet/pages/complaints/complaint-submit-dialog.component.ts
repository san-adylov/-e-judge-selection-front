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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import { catchError, forkJoin, map, type Observable, of } from 'rxjs';

import type { ContestStatus } from '@domain/api/api.types';
import { ComplaintsApi } from '@domain/api/complaints.api';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';

import {
  type Application,
  applicationLabel,
  type Complaint,
  COMPLAINT_TEXT_MAX,
  type ComplaintPreset,
  type ComplaintType,
  documentStageDeadline,
  eligibleComplaintTypes,
  lastRejectionByBoard,
  needsHistory,
  notBlank,
  type StatusHistory,
  toSubmitRequest,
} from './complaint-rules';

/** Параллельная загрузка по id; ошибка по одному id не мешает остальным (значение `null`). */
function loadEach<T, R>(ids: number[], load: (id: number) => Observable<T>, pick: (value: T | null) => R) {
  if (!ids.length) return of(new Map<number, R>());

  return forkJoin(ids.map((id) => load(id).pipe(catchError(() => of(null))))).pipe(
    map((values) => new Map(ids.map((id, index) => [id, pick(values[index] ?? null)]))),
  );
}

/**
 * Подача жалобы (`POST /v1/complaints`). Заявки и типы — только допустимые правилами `ComplaintAdmissibility`:
 * статус заявки, статус конкурса, срок после отклонения Советом, одна жалоба каждого типа.
 */
@Component({
  selector: 'app-complaint-submit-dialog',
  imports: [ReactiveFormsModule, LangPipe, LocalDatePipe, Button, Dialog, Message, Select, Skeleton, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './complaint-submit-dialog.component.html',
})
export class ComplaintSubmitDialogComponent {
  private readonly complaintsApi = inject(ComplaintsApi);
  private readonly contestApi = inject(ContestApi);
  private readonly applicationApi = inject(ContestApplicationApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  /** Заявки кандидата (`GET /contest-application/my`). */
  readonly applications = input.required<readonly Application[]>();
  readonly preset = input<ComplaintPreset | null>(null);
  readonly submitted = output<Complaint>();

  protected readonly textMax = COMPLAINT_TEXT_MAX;
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly presetUnavailable = signal(false);
  protected readonly textLength = signal(0);

  private readonly complaints = signal<Complaint[]>([]);
  private readonly contestStatuses = signal(new Map<number, ContestStatus | null>());
  private readonly histories = signal(new Map<number, StatusHistory[]>());
  private readonly now = signal(new Date());
  private readonly selectedId = signal<number | null>(null);
  private readonly selectedType = signal<ComplaintType | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    applicationId: new FormControl<number | null>(null, Validators.required),
    type: new FormControl<ComplaintType | null>(null, Validators.required),
    text: ['', [Validators.required, notBlank, Validators.maxLength(COMPLAINT_TEXT_MAX)]],
  });

  /** Заявки, по которым сейчас можно подать хотя бы один тип жалобы. */
  protected readonly eligible = computed(() =>
    this.applications()
      .filter((application) => application.id !== undefined)
      .map((application) => ({
        id: application.id!,
        label: applicationLabel(application),
        types: eligibleComplaintTypes({
          application,
          contestStatus: this.contestStatuses().get(application.contestId ?? -1),
          history: this.histories().get(application.id!) ?? [],
          complaints: this.complaints(),
          now: this.now(),
        }),
      }))
      .filter((item) => item.types.length > 0),
  );

  protected readonly types = computed(() => this.eligible().find((item) => item.id === this.selectedId())?.types ?? []);
  protected readonly typeOptions = computed(() => this.types().map((value) => ({ value })));

  /** Последний день жалобы на этап документов по выбранной заявке. */
  protected readonly deadline = computed(() => {
    const id = this.selectedId();

    if (id === null || this.selectedType() !== 'DOCUMENT_STAGE') return null;

    return documentStageDeadline(lastRejectionByBoard(this.histories().get(id) ?? []), this.now());
  });

  constructor() {
    const { applicationId, type, text } = this.form.controls;

    applicationId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.selectedId.set(id);
      this.syncType();
    });
    type.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.selectedType.set(value));
    text.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.textLength.set(value.length));

    effect(() => {
      if (this.visible()) untracked(() => this.open());
    });
  }

  protected submit(): void {
    const body = toSubmitRequest(this.form.getRawValue());

    if (!body || this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    this.complaintsApi.submit(body).subscribe({
      next: (complaint) => {
        this.saving.set(false);
        this.notify.success(
          this.lang.get('complaints.submit.success'),
          this.lang.get('complaints.submit.success-detail'),
        );
        this.visible.set(false);
        this.submitted.emit(complaint);
      },
      error: () => this.saving.set(false),
    });
  }

  protected invalid(name: 'applicationId' | 'type' | 'text'): boolean {
    const control = this.form.controls[name];

    return control.invalid && control.touched;
  }

  private open(): void {
    const applications = this.applications();
    const contestIds = [...new Set(applications.map((item) => item.contestId).filter((id) => id !== undefined))];
    const rejectedIds = applications
      .filter(needsHistory)
      .map((item) => item.id)
      .filter((id) => id !== undefined);

    this.form.reset();
    this.presetUnavailable.set(false);
    this.now.set(new Date());
    this.loading.set(true);

    forkJoin({
      complaints: this.complaintsApi.my({ size: 100 }),
      // Жалоба на нарушение процедуры — только по завершённому конкурсу.
      contests: loadEach(
        contestIds,
        (id) => this.contestApi.get(id),
        (contest) => contest?.status ?? null,
      ),
      // Срок жалобы на этап документов считается от перехода в «Отклонена Советом».
      histories: loadEach(
        rejectedIds,
        (id) => this.applicationApi.history(id),
        (history) => history ?? [],
      ),
    }).subscribe({
      next: ({ complaints, contests, histories }) => {
        this.complaints.set(complaints.content);
        this.contestStatuses.set(contests);
        this.histories.set(histories);
        this.loading.set(false);
        this.applyPreset();
      },
      error: () => this.loading.set(false),
    });
  }

  private applyPreset(): void {
    const preset = this.preset();
    const eligible = this.eligible();
    const applicationId = preset?.applicationId ?? (eligible.length === 1 ? eligible[0].id : null);
    const target = eligible.find((item) => item.id === applicationId);

    if (!target) {
      this.presetUnavailable.set(applicationId !== null);

      return;
    }

    this.form.controls.applicationId.setValue(target.id);

    if (!preset?.type) return;

    if (target.types.includes(preset.type)) this.form.controls.type.setValue(preset.type);
    else this.presetUnavailable.set(true);
  }

  /** Тип сбрасывается, если недоступен для выбранной заявки; единственный доступный выбирается сам. */
  private syncType(): void {
    const types = this.types();
    const control = this.form.controls.type;

    if (control.value && !types.includes(control.value)) control.setValue(null);
    if (!control.value && types.length === 1) control.setValue(types[0]);
  }
}
