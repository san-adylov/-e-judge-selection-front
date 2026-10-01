import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import type { Observable } from 'rxjs';

import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { FileLinkComponent } from '@features/files/file-link.component';
import { SessionService } from '@shared/auth/session.service';
import { LocalDatePipe, ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { type Confirmation, confirmationActions, JUDGES_URL } from './judge-rules';

const FILES = [
  { key: 'decreeFileId', label: 'judge-confirmation.form.decree' },
  { key: 'assignmentFileId', label: 'judge-confirmation.form.assignment' },
  { key: 'qualificationFileId', label: 'judge-confirmation.form.qualification' },
] as const satisfies readonly { key: keyof Confirmation; label: string }[];

/**
 * Подтверждение статуса судьи (`/administrative/judges/confirmations/:id`): секретарь берёт заявку в работу,
 * одобряет (бэкенд выдаёт роль ACTIVE_JUDGE и завершает сессии судьи) или отклоняет с причиной.
 */
@Component({
  selector: 'app-staff-confirmation-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    LocalDatePipe,
    ServerDateTimePipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Dialog,
    Message,
    Skeleton,
    Textarea,
    StatusTagComponent,
    FileLinkComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirmation.page.html',
})
export default class StaffConfirmationPage {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly names = inject(CandidateNamesStore);
  private readonly session = inject(SessionService);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly baseUrl = JUDGES_URL;
  protected readonly files = FILES;
  protected readonly confirmation = signal<Confirmation | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly reason = signal('');

  protected readonly judgeName = computed(() => this.names.name(this.confirmation()?.userId)());
  protected readonly actions = computed(() => confirmationActions(this.confirmation()?.status, this.session.roles()));

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => this.load(id));
    });
  }

  protected review(): void {
    const id = this.confirmation()?.id;

    if (id !== undefined) this.run(this.api.reviewConfirmation(id), 'staff-judges.confirmation.reviewing');
  }

  protected approve(): void {
    const id = this.confirmation()?.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('staff-judges.confirmation.approve-title'),
      message: this.lang.get('staff-judges.confirmation.approve-message'),
      icon: 'pi pi-verified',
      acceptLabel: this.lang.get('staff-judges.confirmation.approve'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.run(this.api.approveConfirmation(id), 'staff-judges.confirmation.approved'),
    });
  }

  protected reject(): void {
    const id = this.confirmation()?.id;
    const reason = this.reason().trim();

    if (id === undefined || !reason) return;

    this.rejecting.set(false);
    this.run(this.api.rejectConfirmation(id, reason), 'staff-judges.confirmation.rejected');
  }

  private run(request: Observable<Confirmation>, successKey: string): void {
    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (confirmation) => {
        this.busy.set(false);
        this.confirmation.set(confirmation);
        this.notify.success(this.lang.get(successKey));
      },
      error: () => this.busy.set(false),
    });
  }

  private load(rawId: string): void {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      this.notFound.set(true);
      this.loading.set(false);

      return;
    }

    this.loading.set(true);
    this.api
      .confirmation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (confirmation) => {
          this.confirmation.set(confirmation);
          this.notFound.set(false);
          this.loading.set(false);
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }
}
