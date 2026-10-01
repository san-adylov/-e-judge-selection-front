import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { catchError, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { DocumentsApi } from '@domain/api/documents.api';
import { OepSigningDialogComponent } from '@features/oep-signing/oep-signing-dialog.component';
import { SessionService } from '@shared/auth/session.service';
import { saveBlob } from '@shared/lib/download';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { type Decision, decisionActions, decisionSignContext } from './meeting-rules';

/**
 * Решения заседания (`GET /decision/by-meeting/{id}`): формирование файла (секретарь), подтверждение
 * (председатель), подпись ОЭП (члены Совета) и скачивание. Решения создаёт система по итогам голосования.
 */
@Component({
  selector: 'app-decisions-panel',
  imports: [LangPipe, ServerDateTimePipe, Button, Skeleton, StatusTagComponent, OepSigningDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
      <div class="mb-3 flex items-center gap-2">
        <h2 class="m-0 flex-1 text-base font-semibold">{{ 'staff-decisions.title' | lang }}</h2>
        <p-button
          icon="pi pi-refresh"
          severity="secondary"
          [text]="true"
          [ariaLabel]="'shell.actions.refresh' | lang"
          (onClick)="reload()"
        />
      </div>

      @if (loading()) {
        <p-skeleton height="3.5rem" />
      } @else {
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (decision of decisions(); track decision.id) {
            @let can = actionsOf()(decision);
            <li class="flex flex-wrap items-center gap-3 rounded-lg border border-surface-200 p-3">
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">{{ 'staff-decisions.document.' + decision.documentType | lang }}</span>
                  <app-status-tag kind="decision" [value]="decision.status" />
                </div>
                <span class="text-xs text-surface-500">
                  @if (decision.applicationId) {
                    {{ 'staff-decisions.application' | lang }} #{{ decision.applicationId }} ·
                  }
                  @if (decision.judgeApplicationId) {
                    {{ 'staff-decisions.judge-application' | lang }} #{{ decision.judgeApplicationId }} ·
                  }
                  {{ decision.createdAt | serverDateTime }}
                  @if (decision.confirmedAt) {
                    · {{ 'staff-decisions.confirmed-at' | lang }} {{ decision.confirmedAt | serverDateTime }}
                  }
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                @if (can.generate) {
                  <p-button
                    size="small"
                    icon="pi pi-file"
                    [label]="'staff-decisions.actions.generate' | lang"
                    [loading]="busy() === decision.id"
                    (onClick)="generate(decision)"
                  />
                }
                @if (can.confirm) {
                  <p-button
                    size="small"
                    icon="pi pi-check"
                    [label]="'staff-decisions.actions.confirm' | lang"
                    [loading]="busy() === decision.id"
                    (onClick)="confirm(decision)"
                  />
                }
                @if (can.sign) {
                  <p-button
                    size="small"
                    icon="pi pi-pencil"
                    severity="warn"
                    [outlined]="true"
                    [label]="'staff-decisions.actions.sign' | lang"
                    (onClick)="sign(decision)"
                  />
                }
                @if (can.download) {
                  <p-button
                    size="small"
                    icon="pi pi-download"
                    severity="secondary"
                    [outlined]="true"
                    [label]="'shell.actions.open' | lang"
                    [loading]="downloading() === decision.id"
                    (onClick)="download(decision)"
                  />
                }
              </div>
            </li>
          } @empty {
            <li class="text-sm text-surface-500">{{ 'staff-decisions.empty' | lang }}</li>
          }
        </ul>
      }
    </section>

    @if (signContext(); as context) {
      <app-oep-signing-dialog [(visible)]="signing" [context]="context" (signed)="onSigned()" />
    }
  `,
})
export class DecisionsPanelComponent {
  private readonly api = inject(DocumentsApi);
  private readonly session = inject(SessionService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly meetingId = input.required<number>();
  /** Счётчик перезагрузки от родителя (события SSE, завершение заседания). */
  readonly version = input(0);

  protected readonly decisions = signal<Decision[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<number | null>(null);
  protected readonly downloading = signal<number | null>(null);
  protected readonly signing = signal(false);
  protected readonly signContext = signal<Schemas['SignRequest'] | null>(null);

  protected readonly actionsOf = computed(() => {
    const roles = this.session.roles();

    return (decision: Decision) => decisionActions(decision, roles);
  });

  constructor() {
    effect(() => {
      this.meetingId();
      this.version();
      untracked(() => this.reload());
    });
  }

  protected reload(): void {
    this.loading.set(true);
    this.api
      .decisionsByMeeting(this.meetingId())
      .pipe(catchError(() => of<Decision[]>([])))
      .subscribe((decisions) => {
        this.decisions.set(decisions);
        this.loading.set(false);
      });
  }

  protected generate(decision: Decision): void {
    this.run(decision, this.api.generateDecision(decision.id ?? 0), 'staff-decisions.generated');
  }

  protected confirm(decision: Decision): void {
    this.run(decision, this.api.confirmDecision(decision.id ?? 0), 'staff-decisions.confirmed');
  }

  protected sign(decision: Decision): void {
    this.signContext.set(decisionSignContext(decision));
    this.signing.set(true);
  }

  protected onSigned(): void {
    this.notify.success(this.lang.get('staff-decisions.signed'));
    this.reload();
  }

  protected download(decision: Decision): void {
    if (decision.id === undefined) return;

    this.downloading.set(decision.id);
    this.api.downloadDecision(decision.id).subscribe({
      next: (response) => {
        this.downloading.set(null);
        saveBlob(response, `decision-${decision.id}.pdf`);
      },
      error: () => this.downloading.set(null),
    });
  }

  private run(decision: Decision, request: ReturnType<DocumentsApi['confirmDecision']>, successKey: string): void {
    this.busy.set(decision.id ?? null);
    request.subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.decisions.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        this.notify.success(this.lang.get(successKey));
      },
      error: () => this.busy.set(null),
    });
  }
}
