import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';

import type { Schemas } from '@domain/api/api.types';
import { CandidateProfileApi } from '@domain/api/candidate-profile.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { CandidateDossierComponent } from '@features/candidate-dossier/candidate-dossier.component';
import { skipErrorToast } from '@shared/api/http-context';
import { AccessDirective } from '@shared/auth/access.directive';
import { LocalDatePipe } from '@shared/lib/format.pipes';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { PresentationDialogComponent } from './presentation-dialog.component';

type Ban = Schemas['BanStatusResponse'];

/**
 * Личное дело кандидата для сотрудников (`/administrative/candidates/:userId`): ограничения на участие
 * (`GET /candidate/{userId}/ban-status`), представление кандидата (Совет) и все разделы личного дела.
 * `?applicationId=` добавляет ответы анкеты по заявке.
 */
@Component({
  selector: 'app-staff-candidate-page',
  imports: [
    LangPipe,
    LocalDatePipe,
    Button,
    Message,
    AccessDirective,
    PageHeaderComponent,
    CandidateDossierComponent,
    PresentationDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (id(); as userId) {
      <div class="flex max-w-6xl flex-col gap-4">
        <app-page-header [title]="name() || 'staff-candidates.title'">
          <p-button
            *appAccess="'COUNCIL'"
            icon="pi pi-file-pdf"
            severity="secondary"
            [outlined]="true"
            [label]="'staff-candidates.presentation.action' | lang"
            (onClick)="presenting.set(true)"
          />
        </app-page-header>

        @if (ban(); as status) {
          @if (status.banned) {
            <p-message severity="warn" icon="pi pi-ban">
              <div class="flex flex-col gap-1 text-sm">
                <span class="font-semibold">
                  {{
                    status.bannedUntil
                      ? ('staff-candidates.ban.until' | lang: { date: (status.bannedUntil | localDate) })
                      : ('staff-candidates.ban.active' | lang)
                  }}
                </span>
                @for (entry of status.entries ?? []; track $index) {
                  @if (entry.active !== false) {
                    <span>
                      {{ entry.reason ? ('status.application.' + entry.reason | lang) : '—' }}
                      · {{ entry.bannedFrom | localDate }} — {{ entry.bannedUntil | localDate }}
                    </span>
                  }
                }
              </div>
            </p-message>
          }
        }

        <app-candidate-dossier [userId]="userId" [applicationId]="applicationIdNumber()" />
        <app-presentation-dialog [userId]="userId" [(visible)]="presenting" />
      </div>
    } @else {
      <app-page-header title="staff-candidates.title" />
      <p-message severity="warn" [text]="'shell.not-found' | lang" />
    }
  `,
})
export default class StaffCandidatePage {
  private readonly profiles = inject(CandidateProfileApi);
  private readonly names = inject(CandidateNamesStore);

  /** `:userId` из маршрута, `?applicationId=` — заявка для ответов анкеты. */
  readonly userId = input.required<string>();
  readonly applicationId = input<string | undefined>();

  protected readonly id = computed(() => {
    const id = Number(this.userId());

    return Number.isInteger(id) && id > 0 ? id : null;
  });
  protected readonly applicationIdNumber = computed(() => {
    const id = Number(this.applicationId());

    return Number.isInteger(id) && id > 0 ? id : undefined;
  });
  protected readonly name = computed(() => {
    const id = this.id();

    return id === null ? '' : this.names.name(id)();
  });
  protected readonly ban = signal<Ban | null>(null);
  protected readonly presenting = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => {
        this.ban.set(null);

        if (id !== null) {
          this.profiles.banStatusOf(id, skipErrorToast()).subscribe({
            next: (status) => this.ban.set(status),
            error: () => undefined,
          });
        }
      });
    });
  }
}
