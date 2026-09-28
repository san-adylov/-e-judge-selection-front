import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, type OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';

import { AuthApi } from '@domain/api/auth.api';
import { apiErrorOf } from '@shared/api/api-error';
import { homeUrl, safeReturnUrl, SIGN_IN_URLS } from '@shared/auth/areas';
import { SessionService } from '@shared/auth/session.service';

const STATE_KEY = 'ejs2.esia.state';
const RETURN_KEY = 'ejs2.esia.returnUrl';

/** Вход кандидата через ЕСИА (PKCE). ЕСИА возвращает на эту же страницу с `?code=&state=`. */
@Component({
  selector: 'app-cabinet-sign-in',
  imports: [RouterLink, LangPipe, Button, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex flex-col items-center gap-3 text-center">
        <img src="/logo.svg" alt="" class="size-16" />
        <h1 class="m-0 text-2xl font-semibold">{{ 'shell.sign-in.cabinet' | lang }}</h1>
        <p class="m-0 text-sm text-surface-500">{{ 'shell.sign-in.cabinet-hint' | lang }}</p>
      </div>

      @if (expired()) {
        <p-message severity="warn" [text]="'shell.errors.session-ended' | lang" />
      }
      @if (error()) {
        <p-message severity="error" [text]="error()!" />
      }

      <p-button
        styleClass="w-full"
        icon="pi pi-shield"
        size="large"
        [label]="'shell.sign-in.esia' | lang"
        [loading]="busy()"
        (onClick)="startEsia()"
      />

      <a class="text-center text-sm text-primary" [routerLink]="staffSignIn">{{ 'shell.sign-in.for-staff' | lang }}</a>
    </div>
  `,
})
export default class CabinetSignInPage implements OnInit {
  private readonly auth = inject(AuthApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);
  private readonly document = inject(DOCUMENT);

  readonly code = input<string>();
  readonly state = input<string>();
  readonly returnUrl = input<string>();
  readonly expired = input<string>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly staffSignIn = SIGN_IN_URLS.administrative;

  ngOnInit(): void {
    const code = this.code();
    const state = this.state();

    if (code && state) this.exchange(code, state);
  }

  protected startEsia(): void {
    this.busy.set(true);
    this.error.set(null);
    this.auth.esiaStart().subscribe({
      next: ({ authorizationUrl, state }) => {
        const storage = this.document.defaultView?.sessionStorage;
        const returnUrl = safeReturnUrl(this.returnUrl());

        storage?.setItem(STATE_KEY, state);

        if (returnUrl) storage?.setItem(RETURN_KEY, returnUrl);
        else storage?.removeItem(RETURN_KEY);

        this.document.location.assign(authorizationUrl);
      },
      error: () => this.busy.set(false),
    });
  }

  private exchange(code: string, state: string): void {
    const storage = this.document.defaultView?.sessionStorage;
    const expectedState = storage?.getItem(STATE_KEY);

    storage?.removeItem(STATE_KEY);

    // Бэкенд сверяет state сам; здесь — ранний отказ, если ответ ЕСИА пришёл не на наш запрос.
    if (expectedState && expectedState !== state) {
      this.error.set(this.lang.get('shell.sign-in.esia-state-mismatch'));

      return;
    }

    this.busy.set(true);
    this.auth.esiaExchange(code, state).subscribe({
      next: (response) => {
        this.session.start(response, 'esia');

        const returnUrl = safeReturnUrl(storage?.getItem(RETURN_KEY));

        storage?.removeItem(RETURN_KEY);
        void this.router.navigateByUrl(returnUrl ?? homeUrl(this.session.session()), { replaceUrl: true });
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorOf(error)?.message ?? this.lang.get('shell.errors.generic'));
        void this.router.navigate([], { queryParams: {}, replaceUrl: true });
      },
    });
  }
}
