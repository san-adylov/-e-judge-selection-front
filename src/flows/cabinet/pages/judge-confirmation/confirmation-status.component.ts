import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';

import { DirectoryStore } from '@domain/stores/directory.store';
import { FileLinkComponent } from '@features/files/file-link.component';
import { SessionService } from '@shared/auth/session.service';
import { LocalDatePipe, ServerDateTimePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { type Confirmation, type ConfirmationView, courtNameOf, FILE_FIELDS } from './judge-confirmation.logic';

/**
 * Отправленная заявка — только чтение: у секретаря (PENDING_SECRETARY_REVIEW / UNDER_REVIEW) или с решением.
 * После одобрения бэкенд добавляет роль ACTIVE_JUDGE и отзывает токены — права появятся после повторного входа.
 */
@Component({
  selector: 'app-judge-confirmation-status',
  imports: [
    RouterLink,
    LangPipe,
    Button,
    Message,
    FileLinkComponent,
    LocalDatePipe,
    ServerDateTimePipe,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = confirmation();
    <section class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="m-0 min-w-0 flex-1 text-lg font-semibold">
          {{ 'judge-confirmation.state.number' | lang: { id: item.id ?? '' } }}
        </h2>
        <app-status-tag kind="judgeConfirmation" [value]="item.status" />
      </div>

      @switch (view()) {
        @case ('pending') {
          <p-message severity="info" styleClass="mt-4" [text]="'judge-confirmation.state.pending' | lang" />
        }
        @case ('approved') {
          <p-message severity="success" styleClass="mt-4">
            <div class="flex flex-col gap-2">
              <span>{{ 'judge-confirmation.state.approved' | lang }}</span>
              @if (isJudge()) {
                <a routerLink="/cabinet/judge-applications" class="font-medium text-primary hover:underline">
                  {{ 'judge-confirmation.state.open-applications' | lang }} →
                </a>
              } @else {
                <span>{{ 'judge-confirmation.state.relogin' | lang }}</span>
                <p-button
                  icon="pi pi-sign-in"
                  size="small"
                  styleClass="self-start"
                  [label]="'judge-confirmation.state.relogin-action' | lang"
                  (onClick)="relogin()"
                />
              }
            </div>
          </p-message>
        }
        @case ('rejected') {
          <p-message severity="error" styleClass="mt-4">
            <div class="flex flex-col gap-1">
              <span class="font-medium">{{ 'judge-confirmation.state.rejected' | lang }}</span>
              @if (item.rejectReason) {
                <span>{{ 'judge-confirmation.state.reason' | lang }}: {{ item.rejectReason }}</span>
              }
            </div>
          </p-message>
        }
      }

      <dl class="m-0 mt-4 grid gap-x-6 gap-y-3 text-sm tablet:grid-cols-2">
        <div>
          <dt class="text-xs text-surface-500">{{ 'judge-confirmation.form.court' | lang }}</dt>
          <dd class="m-0">{{ courtName() || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-surface-500">{{ 'judge-confirmation.form.experience' | lang }}</dt>
          <dd class="m-0">{{ item.workExperienceFrom | localDate }} — {{ item.workExperienceTo | localDate }}</dd>
        </div>
        <div>
          <dt class="text-xs text-surface-500">{{ 'judge-confirmation.state.submitted' | lang }}</dt>
          <dd class="m-0">{{ item.submittedAt | serverDateTime }}</dd>
        </div>
        @if (item.decidedAt) {
          <div>
            <dt class="text-xs text-surface-500">{{ 'judge-confirmation.state.decided' | lang }}</dt>
            <dd class="m-0">{{ item.decidedAt | serverDateTime }}</dd>
          </div>
        }
        <div class="tablet:col-span-2">
          <dt class="text-xs text-surface-500">{{ 'judge-confirmation.form.documents' | lang }}</dt>
          <dd class="m-0 mt-1 flex flex-col gap-1.5">
            @for (file of files; track file.key) {
              <div class="flex flex-wrap items-center gap-x-2">
                <span class="text-surface-700">{{ file.label | lang }}:</span>
                @if (item[file.key]; as fileId) {
                  <app-file-link [fileId]="fileId" />
                } @else {
                  <span>—</span>
                }
              </div>
            }
          </dd>
        </div>
      </dl>

      @if (canStartNew()) {
        <div class="mt-4 flex justify-end">
          <p-button
            icon="pi pi-plus"
            [outlined]="view() === 'approved'"
            [severity]="view() === 'approved' ? 'secondary' : undefined"
            [label]="
              (view() === 'rejected' ? 'judge-confirmation.state.new' : 'judge-confirmation.state.repeat') | lang
            "
            (onClick)="startNew.emit()"
          />
        </div>
      }
    </section>
  `,
})
export class ConfirmationStatusComponent {
  private readonly session = inject(SessionService);
  private readonly courts = inject(DirectoryStore).options('COURT_NAME');

  readonly confirmation = input.required<Confirmation>();
  readonly view = input.required<ConfirmationView>();
  readonly canStartNew = input(false);
  readonly startNew = output();

  protected readonly files = FILE_FIELDS;
  protected readonly isJudge = computed(() => this.session.can('ACTIVE_JUDGE'));
  protected readonly courtName = computed(() => {
    const item = this.confirmation();

    return courtNameOf(item.courtId ?? null, this.courts(), item);
  });

  /** Выход с отзывом сессии: при новом входе токен придёт уже с ролью ACTIVE_JUDGE. */
  protected relogin(): void {
    void this.session.logout();
  }
}
