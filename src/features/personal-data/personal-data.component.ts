import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import { CandidateProfileApi } from '@domain/api/candidate-profile.api';
import { apiErrorOf } from '@shared/api/api-error';
import { skipErrorToast } from '@shared/api/http-context';
import { SessionService } from '@shared/auth/session.service';
import { NotifyService } from '@shared/ui/notify.service';

import type { ProfileRequest, ProfileResponse } from './personal-data.mapping';
import { PersonalDataFormComponent } from './personal-data-form.component';
import { PersonalDataViewComponent } from './personal-data-view.component';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Раздел «Личные данные» (`/v1/candidate/profile`): просмотр и редактирование своей записи.
 * `GET` отвечает 404 (4041), пока запись не создана, — это не ошибка: сразу показываем форму, первое сохранение — `POST`.
 */
@Component({
  selector: 'app-personal-data',
  imports: [LangPipe, Button, Message, Skeleton, PersonalDataFormComponent, PersonalDataViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-surface-200 bg-surface-0">
      <header class="flex items-center gap-3 border-b border-surface-100 px-4 py-3 tablet:px-5">
        <h2 class="m-0 flex-1 text-lg font-semibold">{{ 'profile.section.PERSONAL_DATA' | lang }}</h2>
        @if (state() === 'ready' && profile() && !editing()) {
          <p-button
            icon="pi pi-pencil"
            size="small"
            severity="secondary"
            [outlined]="true"
            [label]="'shell.actions.edit' | lang"
            (onClick)="editing.set(true)"
          />
        }
      </header>

      <div class="p-4 tablet:p-5">
        @switch (state()) {
          @case ('loading') {
            <div class="grid grid-cols-1 gap-3 tablet:grid-cols-2">
              @for (row of [1, 2, 3, 4]; track row) {
                <p-skeleton height="2.75rem" />
              }
            </div>
          }
          @case ('error') {
            <div class="flex flex-col items-start gap-3">
              <p-message severity="error" [text]="error() ?? ''" />
              <p-button
                icon="pi pi-refresh"
                severity="secondary"
                [outlined]="true"
                [label]="'personal.retry' | lang"
                (onClick)="load()"
              />
            </div>
          }
          @default {
            @if (editing() || !profile()) {
              @if (!profile()) {
                <p-message styleClass="mb-5" severity="info" [text]="'personal.first-fill' | lang" />
              }
              <app-personal-data-form
                [profile]="profile()"
                [fullName]="session.user()?.fullName ?? null"
                [saving]="saving()"
                [cancellable]="!!profile()"
                (save)="save($event)"
                (cancelled)="editing.set(false)"
              />
            } @else {
              <app-personal-data-view [profile]="profile()!" />
            }
          }
        }
      </div>
    </section>
  `,
})
export class PersonalDataComponent {
  private readonly api = inject(CandidateProfileApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  protected readonly session = inject(SessionService);

  /** Текущие личные данные (`null` — ещё не заполнены) — для сводки о полноте личного дела. */
  readonly profileChange = output<ProfileResponse | null>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly profile = signal<ProfileResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.api.my(skipErrorToast()).subscribe({
      next: (profile) => this.loaded(profile),
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.loaded(null);

          return;
        }

        this.error.set(apiErrorOf(error)?.message ?? this.lang.get('shell.errors.generic'));
        this.state.set('error');
      },
    });
  }

  protected save(body: ProfileRequest): void {
    const request = this.profile() ? this.api.update(body) : this.api.create(body);

    this.saving.set(true);
    request.subscribe({
      next: (profile) => {
        this.saving.set(false);
        this.editing.set(false);
        this.loaded(profile);
        this.notify.success(this.lang.get('personal.saved'));
      },
      error: () => this.saving.set(false),
    });
  }

  private loaded(profile: ProfileResponse | null): void {
    this.profile.set(profile);
    this.state.set('ready');
    this.profileChange.emit(profile);
  }
}
