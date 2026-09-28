import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';

import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { JUDGE_APPLICATIONS_URL, type JudgeApplication } from './judge-application.model';
import { JudgeApplicationCreateDialogComponent } from './judge-application-create-dialog.component';

/** Заявки действующего судьи на участие в конкурсах (§17.2): `GET /judge-applications/my`. */
@Component({
  selector: 'app-judge-applications-page',
  imports: [
    RouterLink,
    LangPipe,
    ServerDateTimePipe,
    Button,
    Skeleton,
    PageHeaderComponent,
    StatusTagComponent,
    JudgeApplicationCreateDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-5xl">
      <app-page-header title="judge-applications.title" subtitle="judge-applications.subtitle">
        <p-button icon="pi pi-plus" [label]="'judge-applications.new' | lang" (onClick)="creating.set(true)" />
      </app-page-header>

      @if (loading()) {
        <div class="flex flex-col gap-3">
          @for (row of [1, 2]; track row) {
            <p-skeleton height="6rem" borderRadius="0.75rem" />
          }
        </div>
      } @else {
        <div class="flex flex-col gap-3">
          @for (item of items(); track item.id) {
            <a
              class="block rounded-xl border border-surface-200 bg-surface-0 p-4 text-inherit no-underline transition-colors hover:border-primary tablet:p-5"
              [routerLink]="[baseUrl, item.id]"
            >
              <div class="flex flex-wrap items-start gap-3">
                <div class="min-w-0 flex-1">
                  <div class="font-semibold break-words">{{ item.contestName || '—' }}</div>
                  @if (item.registrationNumber) {
                    <div class="mt-1 text-sm text-surface-500">
                      {{ 'judge-applications.fields.registration-number' | lang }}: {{ item.registrationNumber }}
                    </div>
                  }
                </div>
                <app-status-tag kind="judgeApplication" [value]="item.status" />
              </div>

              <dl class="m-0 mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm tablet:grid-cols-3">
                <div class="flex gap-1">
                  <dt class="text-surface-500">{{ 'judge-applications.fields.created-at' | lang }}:</dt>
                  <dd class="m-0">{{ item.createdAt | serverDateTime }}</dd>
                </div>
                @if (item.submittedAt) {
                  <div class="flex gap-1">
                    <dt class="text-surface-500">{{ 'judge-applications.fields.submitted-at' | lang }}:</dt>
                    <dd class="m-0">{{ item.submittedAt | serverDateTime }}</dd>
                  </div>
                }
                @if (item.interviewDate) {
                  <div class="flex gap-1">
                    <dt class="text-surface-500">{{ 'judge-applications.fields.interview-date' | lang }}:</dt>
                    <dd class="m-0">{{ item.interviewDate | serverDateTime }}</dd>
                  </div>
                } @else if (item.registeredAt) {
                  <div class="flex gap-1">
                    <dt class="text-surface-500">{{ 'judge-applications.fields.registered-at' | lang }}:</dt>
                    <dd class="m-0">{{ item.registeredAt | serverDateTime }}</dd>
                  </div>
                }
              </dl>
            </a>
          } @empty {
            <div class="rounded-xl border border-surface-200 bg-surface-0 p-8 text-center">
              <i class="pi pi-briefcase text-3xl text-surface-400"></i>
              <p class="m-0 mt-3 font-medium">{{ 'judge-applications.empty' | lang }}</p>
              <p class="m-0 mt-1 text-sm text-surface-500">{{ 'judge-applications.empty-hint' | lang }}</p>
            </div>
          }
        </div>
      }
    </div>

    <app-judge-application-create-dialog
      [applications]="items()"
      [(visible)]="creating"
      (created)="onCreated($event)"
    />
  `,
})
export default class JudgeApplicationsPage implements OnInit {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly router = inject(Router);

  protected readonly baseUrl = JUDGE_APPLICATIONS_URL;
  protected readonly items = signal<JudgeApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);

  ngOnInit(): void {
    this.api.my().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onCreated(application: JudgeApplication): void {
    if (application.id !== undefined) void this.router.navigate([this.baseUrl, application.id]);
  }
}
