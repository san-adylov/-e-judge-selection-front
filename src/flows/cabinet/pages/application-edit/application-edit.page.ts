import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { map, type Observable, of, switchMap } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { isWizardStatus } from '@features/application-draft/draft-form';
import { apiErrorOf } from '@shared/api/api-error';
import { skipErrorToast } from '@shared/api/http-context';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { ApplicationWizardComponent } from './application-wizard.component';

type Application = Schemas['ApplicationResponse'];
type Contest = Schemas['ContestResponse'];

/**
 * Мастер заявки на конкурс `/cabinet/applications/:id/edit`. Вместо 13 шагов v1 — только то, что относится к заявке:
 * контакты, проверка личного дела, ответы анкеты, документы конкурса, отправка. Разделы личного дела — в `/cabinet/profile`.
 */
@Component({
  selector: 'app-application-edit-page',
  imports: [
    RouterLink,
    LangPipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Message,
    Skeleton,
    PageHeaderComponent,
    StatusTagComponent,
    ApplicationWizardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="wizard.title" subtitle="wizard.subtitle">
      <a pButton severity="secondary" [text]="true" [routerLink]="detailsLink()">
        <i pButtonIcon class="pi pi-arrow-left"></i>
        <span pButtonLabel>{{ 'wizard.to-application' | lang }}</span>
      </a>
    </app-page-header>

    <div class="flex max-w-5xl flex-col gap-4">
      @if (loading()) {
        <p-skeleton height="5rem" borderRadius="0.75rem" />
        <p-skeleton height="20rem" borderRadius="0.75rem" />
      } @else if (application(); as app) {
        <section
          class="flex flex-wrap items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5"
        >
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="text-xs uppercase tracking-wide text-surface-500">{{ 'wizard.contest' | lang }}</span>
            @if (app.contestId !== undefined) {
              <a class="font-semibold text-primary hover:underline" [routerLink]="['/cabinet/contests', app.contestId]">
                {{ contest()?.name || app.contestName }}
              </a>
            } @else {
              <span class="font-semibold">{{ app.contestName }}</span>
            }
            @if (app.registrationNumber) {
              <span class="text-sm text-surface-500">
                {{ 'wizard.registration-number' | lang }}: {{ app.registrationNumber }}
              </span>
            }
          </div>
          <app-status-tag kind="application" [value]="app.status" />
        </section>

        @if (!editable()) {
          <div class="flex flex-col items-start gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
            <p-message severity="info" [text]="'wizard.not-editable' | lang" />
            <a pButton [routerLink]="detailsLink()">
              <span pButtonLabel>{{ 'wizard.to-application' | lang }}</span>
            </a>
          </div>
        } @else {
          @if (app.status === 'RETURNED_FOR_CORRECTION') {
            <p-message severity="warn">
              <div class="flex flex-col gap-1">
                <span class="font-semibold">{{ 'wizard.returned.title' | lang }}</span>
                <span class="whitespace-pre-line">{{ app.returnReason || '—' }}</span>
                <span class="text-sm">{{ 'wizard.returned.hint' | lang }}</span>
              </div>
            </p-message>
          }

          <app-application-wizard [application]="app" [contest]="contest()" [doneLink]="detailsLink()" />
        }
      } @else {
        <div class="flex flex-col items-start gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
          <p-message severity="error" [text]="error() || ('wizard.load-failed' | lang)" />
          <p-button icon="pi pi-refresh" [outlined]="true" [label]="'wizard.retry' | lang" (onClick)="retry()" />
        </div>
      }
    </div>
  `,
})
export default class ApplicationEditPage {
  private readonly applications = inject(ContestApplicationApi);
  private readonly contests = inject(ContestApi);

  readonly id = input.required<string>();

  protected readonly application = signal<Application | null>(null);
  protected readonly contest = signal<Contest | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly detailsLink = computed(() => `/cabinet/applications/${this.id()}`);
  protected readonly editable = computed(() => isWizardStatus(this.application()?.status));

  constructor() {
    effect(() => {
      const id = Number(this.id());

      untracked(() => this.load(id));
    });
  }

  protected retry(): void {
    this.load(Number(this.id()));
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.application.set(null);
    // Ошибку (в т. ч. 404 чужой или несуществующей заявки) показываем на странице, без тоста.
    this.applications
      .get(id, skipErrorToast())
      .pipe(
        switchMap((application) => {
          const contest$: Observable<Contest | null> =
            application.contestId === undefined ? of(null) : this.contests.get(application.contestId);

          return contest$.pipe(map((contest) => ({ application, contest })));
        }),
      )
      .subscribe({
        next: ({ application, contest }) => {
          this.application.set(application);
          this.contest.set(contest);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorOf(error)?.message ?? null);
          this.loading.set(false);
        },
      });
  }
}
