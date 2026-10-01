import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import { FORBIDDEN_URL, homeUrl } from '@shared/auth/areas';
import { SessionService } from '@shared/auth/session.service';

/**
 * `/forbidden` и 404: `data.code` маршрута — `forbidden` | `not-found`.
 * Если «главная» для текущей сессии — снова `/forbidden` (у учётной записи нет ни одной группы),
 * вместо неё предлагается выход: иначе кнопка ведёт по кругу.
 */
@Component({
  selector: 'app-error-page',
  imports: [RouterLink, LangPipe, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-50 px-4 text-center">
      <i class="pi text-5xl text-primary" [class]="code() === 'forbidden' ? 'pi-lock' : 'pi-compass'"></i>
      <h1 class="m-0 text-2xl font-semibold">{{ 'shell.errors.' + code() + '.title' | lang }}</h1>
      <p class="m-0 max-w-md text-surface-500">{{ 'shell.errors.' + code() + '.text' | lang }}</p>
      @if (session.user(); as user) {
        <p class="m-0 max-w-md text-sm text-surface-500">
          {{ 'shell.errors.signed-in-as' | lang: { name: user.fullName || user.username, roles: roles() } }}
        </p>
      }
      <div class="flex flex-wrap justify-center gap-2">
        @if (home(); as home) {
          <p-button icon="pi pi-home" [routerLink]="home" [label]="'shell.errors.home' | lang" />
        }
        @if (session.isAuthenticated()) {
          <p-button
            icon="pi pi-sign-out"
            severity="secondary"
            [outlined]="true"
            [label]="'shell.logout' | lang"
            (onClick)="session.logout()"
          />
        }
      </div>
    </main>
  `,
})
export default class ErrorPage {
  protected readonly session = inject(SessionService);

  readonly code = input<'forbidden' | 'not-found'>('not-found');

  protected readonly roles = computed(() => this.session.roles().join(', ') || '—');
  /** Куда ведёт «На главную»; `null`, если это снова страница отказа. */
  protected readonly home = computed(() => {
    const url = homeUrl(this.session.session());

    return url === FORBIDDEN_URL ? null : url;
  });
}
