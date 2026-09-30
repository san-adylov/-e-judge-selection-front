import { ChangeDetectionStrategy, Component, inject, input, type OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import { homeUrl } from '@shared/auth/areas';
import { SessionService } from '@shared/auth/session.service';

import { EssayIntroComponent } from './essay-intro.component';
import { EssayResultComponent } from './essay-result.component';
import { EssayWorkStore } from './essay-work.store';
import { EssayWritingComponent } from './essay-writing.component';

/**
 * `/testing/essay` — письменное задание по токену этапа ESSAY: вводная → текст с таймером → итог.
 * Тема и срок — `GET /essay/my`, отправка — `PUT /essay/my/reply` (один раз).
 */
@Component({
  selector: 'app-essay-page',
  imports: [LangPipe, Button, Message, Skeleton, EssayIntroComponent, EssayWritingComponent, EssayResultComponent],
  providers: [EssayWorkStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <p class="sr-only" aria-live="assertive" aria-atomic="true">{{ store.announcement() }}</p>

      @switch (store.phase()) {
        @case ('loading') {
          <div class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
            <p-skeleton height="2rem" width="60%" />
            <p-skeleton height="6rem" />
            <p-skeleton height="2.5rem" width="12rem" />
          </div>
        }
        @case ('error') {
          <section class="flex flex-col gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5">
            <h1 class="m-0 text-xl font-semibold">{{ 'essay.error.title' | lang }}</h1>
            <p-message severity="error" [text]="store.loadError() ?? ('essay.error.generic' | lang)" />
            <div class="flex flex-wrap gap-2">
              <p-button icon="pi pi-refresh" [label]="'essay.error.retry' | lang" (onClick)="reload()" />
              <p-button
                icon="pi pi-sign-out"
                severity="secondary"
                [outlined]="true"
                [label]="'essay.result.logout' | lang"
                (onClick)="store.logout()"
              />
            </div>
          </section>
        }
        @case ('intro') {
          <app-essay-intro />
        }
        @case ('done') {
          <app-essay-result />
        }
        @case ('expired') {
          <app-essay-result />
        }
        @default {
          <app-essay-writing />
        }
      }
    </div>
  `,
})
export default class EssayPage implements OnInit {
  protected readonly store = inject(EssayWorkStore);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** `?applicationId=` — только для входа обычным токеном кандидата; с токеном этапа не нужен. */
  readonly applicationId = input<string>();

  ngOnInit(): void {
    const stage = this.session.stage();

    // Токен теста сюда не пускает бэкенд (4318) — сразу на свой экран.
    if (stage?.exerciseType === 'TEST') {
      void this.router.navigateByUrl(homeUrl(this.session.session()));

      return;
    }

    this.reload();
  }

  protected reload(): void {
    const applicationId = Number(this.applicationId());

    this.store.load(
      this.session.stage() || !Number.isFinite(applicationId) || applicationId <= 0 ? undefined : applicationId,
    );
  }
}
