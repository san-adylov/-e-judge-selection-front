import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';

import type { Schemas } from '@domain/api/api.types';
import { ComplaintsApi } from '@domain/api/complaints.api';
import { FileLinkComponent } from '@features/files/file-link.component';
import { AccessDirective } from '@shared/auth/access.directive';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

type Complaint = Schemas['ComplaintResponse'];

/**
 * Жалоба для сотрудника: текст, решение заседания, документы. Действия: передать на рассмотрение (Совет,
 * пока жалоба подана), заключение (секретарь, по решённой жалобе), разбор теста (по жалобе на результат теста).
 */
@Component({
  selector: 'app-complaint-card',
  imports: [
    RouterLink,
    LangPipe,
    ServerDateTimePipe,
    Button,
    Message,
    AccessDirective,
    FileLinkComponent,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = complaint();
    <article class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <header class="flex flex-wrap items-center gap-2">
        <app-status-tag kind="complaintType" [value]="item.type" />
        <app-status-tag kind="complaint" [value]="item.status" />
        <span class="text-sm text-surface-500">#{{ item.id }} · {{ item.createdAt | serverDateTime }}</span>
        <span class="ml-auto flex flex-wrap gap-2">
          <a
            class="text-sm text-primary no-underline hover:underline"
            [routerLink]="['/administrative/applications', item.applicationId]"
          >
            {{ 'staff-complaints.card.application' | lang }} #{{ item.applicationId }}
          </a>
          @if (item.meetingId) {
            <a
              class="text-sm text-primary no-underline hover:underline"
              [routerLink]="['/administrative/meetings', item.meetingId]"
            >
              {{ 'staff-complaints.card.meeting' | lang }} #{{ item.meetingId }}
            </a>
          }
        </span>
      </header>

      <p class="m-0 rounded-lg bg-surface-50 p-3 text-sm leading-relaxed whitespace-pre-line break-words">
        {{ item.text }}
      </p>

      @if (decided()) {
        <section class="rounded-lg border border-surface-200 p-3">
          <p
            class="m-0 font-medium"
            [class.text-green-700]="item.status === 'APPROVED'"
            [class.text-red-700]="item.status === 'REJECTED'"
          >
            {{ (item.status === 'APPROVED' ? 'complaints.details.approved' : 'complaints.details.rejected') | lang }}
            @if (item.finalDecision) {
              · {{ 'staff-complaints.card.final' | lang }}
            }
          </p>
          @if (item.decisionDate) {
            <p class="m-0 mt-1 text-sm text-surface-500">
              {{ 'complaints.details.decision-date' | lang }}: {{ item.decisionDate | serverDateTime }}
            </p>
          }
          @if (item.decisionComment) {
            <p class="m-0 mt-2 text-sm whitespace-pre-line">{{ item.decisionComment }}</p>
          }
        </section>
      } @else if (item.status === 'SUBMITTED') {
        <p-message severity="warn" icon="pi pi-clock" [text]="'staff-complaints.card.waiting' | lang" />
      }

      <div class="flex flex-wrap items-center gap-3 border-t border-surface-200 pt-3">
        @if (item.conclusionFileId) {
          <span class="inline-flex items-center gap-1 text-sm">
            <span class="text-surface-500">{{ 'complaints.details.conclusion' | lang }}:</span>
            <app-file-link [fileId]="item.conclusionFileId" />
          </span>
        }
        @if (item.testReviewFileId) {
          <span class="inline-flex items-center gap-1 text-sm">
            <span class="text-surface-500">{{ 'complaints.details.test-review' | lang }}:</span>
            <app-file-link [fileId]="item.testReviewFileId" />
          </span>
        }
        <span class="ml-auto flex flex-wrap gap-2">
          @if (item.status === 'SUBMITTED') {
            <p-button
              *appAccess="'COUNCIL'"
              size="small"
              icon="pi pi-calendar-plus"
              [label]="'staff-complaints.actions.review' | lang"
              (onClick)="review.emit(item)"
            />
          }
          @if (item.type === 'TEST_RESULT' && !item.testReviewFileId) {
            <p-button
              size="small"
              icon="pi pi-file-pdf"
              severity="secondary"
              [outlined]="true"
              [label]="'complaints.actions.generate-review' | lang"
              [loading]="busy() === 'review'"
              (onClick)="generate('review')"
            />
          }
          @if (decided() && !item.conclusionFileId) {
            <p-button
              *appAccess="'SECRETARY'"
              size="small"
              icon="pi pi-file"
              severity="secondary"
              [outlined]="true"
              [label]="'staff-complaints.actions.conclusion' | lang"
              [loading]="busy() === 'conclusion'"
              (onClick)="generate('conclusion')"
            />
          }
        </span>
      </div>
    </article>
  `,
})
export class ComplaintCardComponent {
  private readonly api = inject(ComplaintsApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly complaint = input.required<Complaint>();
  readonly review = output<Complaint>();
  readonly changed = output<Complaint>();

  protected readonly busy = signal<'review' | 'conclusion' | null>(null);
  protected readonly decided = computed(() => ['APPROVED', 'REJECTED'].includes(this.complaint().status ?? ''));

  protected generate(kind: 'review' | 'conclusion'): void {
    const item = this.complaint();

    if (item.id === undefined) return;

    const request = kind === 'review' ? this.api.testReviewDocument(item.id) : this.api.conclusion(item.id);

    this.busy.set(kind);
    request.subscribe({
      next: (file) => {
        this.busy.set(null);
        this.notify.success(this.lang.get('staff-complaints.toast.generated'));
        this.changed.emit(
          kind === 'review' ? { ...item, testReviewFileId: file.id } : { ...item, conclusionFileId: file.id },
        );
      },
      error: () => this.busy.set(null),
    });
  }
}
