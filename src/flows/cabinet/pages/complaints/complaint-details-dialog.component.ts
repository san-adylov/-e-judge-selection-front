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
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import { ComplaintsApi } from '@domain/api/complaints.api';
import { FileLinkComponent } from '@features/files/file-link.component';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { type Complaint } from './complaint-rules';

/**
 * Карточка жалобы (`GET /v1/complaints/{id}`): полный текст, решение, заключение и разбор теста.
 * Разбор теста автор жалобы на результат тестирования формирует сам (`POST …/test-review-document`).
 */
@Component({
  selector: 'app-complaint-details-dialog',
  imports: [LangPipe, ServerDateTimePipe, Button, Dialog, Message, Skeleton, FileLinkComponent, StatusTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-2xl mx-4"
      [modal]="true"
      [header]="'complaints.details.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      @let item = complaint();
      @if (!item) {
        <div class="flex flex-col gap-3">
          <p-skeleton height="1.75rem" width="60%" />
          <p-skeleton height="6rem" />
          <p-skeleton height="3rem" />
        </div>
      } @else {
        <div class="flex flex-col gap-5">
          <div class="flex flex-wrap items-center gap-2">
            <app-status-tag kind="complaintType" [value]="item.type" />
            <app-status-tag kind="complaint" [value]="item.status" />
            <span class="text-sm text-surface-500">
              {{ 'complaints.list.submitted-at' | lang }} {{ item.createdAt | serverDateTime }}
            </span>
          </div>

          @if (applicationLabel()) {
            <div>
              <div class="text-xs text-surface-500">{{ 'complaints.list.application' | lang }}</div>
              <div class="font-medium">{{ applicationLabel() }}</div>
            </div>
          }

          <section>
            <h3 class="m-0 mb-2 text-sm font-semibold text-surface-600">{{ 'complaints.details.text' | lang }}</h3>
            <p class="m-0 whitespace-pre-line break-words rounded-lg bg-surface-50 p-3 text-sm">{{ item.text }}</p>
          </section>

          @if (decided()) {
            <section class="rounded-lg border border-surface-200 p-3 tablet:p-4">
              <h3 class="m-0 mb-2 text-sm font-semibold text-surface-600">
                {{ 'complaints.details.decision' | lang }}
              </h3>
              <p
                class="m-0 font-medium"
                [class.text-green-700]="item.status === 'APPROVED'"
                [class.text-red-700]="item.status === 'REJECTED'"
              >
                {{
                  (item.status === 'APPROVED' ? 'complaints.details.approved' : 'complaints.details.rejected') | lang
                }}
              </p>
              @if (item.decisionDate) {
                <p class="m-0 mt-1 text-sm text-surface-500">
                  {{ 'complaints.details.decision-date' | lang }}: {{ item.decisionDate | serverDateTime }}
                </p>
              }
              @if (item.decisionComment) {
                <p class="m-0 mt-2 whitespace-pre-line text-sm">
                  <span class="text-surface-500">{{ 'complaints.details.comment' | lang }}:</span>
                  {{ item.decisionComment }}
                </p>
              }
            </section>
          } @else {
            <p-message severity="info" icon="pi pi-hourglass" [text]="'complaints.details.' + item.status | lang" />
          }

          @if (item.conclusionFileId || item.testReviewFileId || canGenerateReview()) {
            <section>
              <h3 class="m-0 mb-2 text-sm font-semibold text-surface-600">{{ 'complaints.details.files' | lang }}</h3>
              <ul class="m-0 flex list-none flex-col gap-2 p-0">
                @if (item.conclusionFileId) {
                  <li class="flex flex-wrap items-center gap-x-2">
                    <span class="text-sm text-surface-500">{{ 'complaints.details.conclusion' | lang }}:</span>
                    <app-file-link [fileId]="item.conclusionFileId" />
                  </li>
                }
                @if (item.testReviewFileId) {
                  <li class="flex flex-wrap items-center gap-x-2">
                    <span class="text-sm text-surface-500">{{ 'complaints.details.test-review' | lang }}:</span>
                    <app-file-link [fileId]="item.testReviewFileId" />
                  </li>
                } @else if (canGenerateReview()) {
                  <li>
                    <p-button
                      icon="pi pi-file-pdf"
                      size="small"
                      severity="secondary"
                      [outlined]="true"
                      [label]="'complaints.actions.generate-review' | lang"
                      [loading]="generating()"
                      (onClick)="generateReview()"
                    />
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </p-dialog>
  `,
})
export class ComplaintDetailsDialogComponent {
  private readonly api = inject(ComplaintsApi);

  readonly visible = model(false);
  readonly complaintId = input<number | null>(null);
  /** Подпись заявки из списка страницы: в ответе жалобы только `applicationId`. */
  readonly applicationLabel = input('');
  /** Жалоба изменилась (сформирован разбор теста) — обновить карточку в списке. */
  readonly changed = output<Complaint>();

  protected readonly complaint = signal<Complaint | null>(null);
  protected readonly generating = signal(false);

  protected readonly decided = computed(() => ['APPROVED', 'REJECTED'].includes(this.complaint()?.status ?? ''));
  protected readonly canGenerateReview = computed(() => {
    const item = this.complaint();

    return item?.type === 'TEST_RESULT' && !item.testReviewFileId;
  });

  constructor() {
    effect(() => {
      const id = this.complaintId();

      if (this.visible() && id !== null) untracked(() => this.load(id));
    });
  }

  protected generateReview(): void {
    const id = this.complaint()?.id;

    if (id === undefined) return;

    this.generating.set(true);
    this.api.testReviewDocument(id).subscribe({
      next: (file) => {
        const updated = { ...this.complaint(), testReviewFileId: file.id };

        this.generating.set(false);
        this.complaint.set(updated);
        this.changed.emit(updated);
      },
      error: () => this.generating.set(false),
    });
  }

  private load(id: number): void {
    if (this.complaint()?.id !== id) this.complaint.set(null);

    this.api.get(id).subscribe({
      next: (complaint) => this.complaint.set(complaint),
      error: () => this.visible.set(false),
    });
  }
}
