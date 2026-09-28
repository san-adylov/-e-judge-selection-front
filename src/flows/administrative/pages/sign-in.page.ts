import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';

import { AuthApi } from '@domain/api/auth.api';
import { apiErrorOf } from '@shared/api/api-error';
import { homeUrl, safeReturnUrl, SIGN_IN_URLS } from '@shared/auth/areas';
import { SessionService } from '@shared/auth/session.service';

/** Вход сотрудников по логину и паролю. Для ролей Совета действует рабочее окно (ошибка 4302). */
@Component({
  selector: 'app-administrative-sign-in',
  imports: [ReactiveFormsModule, RouterLink, LangPipe, Button, InputText, Message, Password],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-5" [formGroup]="form" (ngSubmit)="submit()">
      <div class="flex flex-col items-center gap-3 text-center">
        <img src="/logo.svg" alt="" class="size-16" />
        <h1 class="m-0 text-2xl font-semibold">{{ 'shell.sign-in.administrative' | lang }}</h1>
      </div>

      @if (expired()) {
        <p-message severity="warn" [text]="'shell.errors.session-ended' | lang" />
      }
      @if (error()) {
        <p-message severity="error" [text]="error()!" />
      }

      <div class="flex flex-col gap-1">
        <label for="username" class="text-sm font-medium">{{ 'shell.sign-in.username' | lang }}</label>
        <input pInputText id="username" autocomplete="username" formControlName="username" />
      </div>

      <div class="flex flex-col gap-1">
        <label for="password" class="text-sm font-medium">{{ 'shell.sign-in.password' | lang }}</label>
        <p-password
          inputId="password"
          autocomplete="current-password"
          styleClass="w-full"
          inputStyleClass="w-full"
          formControlName="password"
          [feedback]="false"
          [toggleMask]="true"
        />
      </div>

      <p-button type="submit" styleClass="w-full" [label]="'shell.sign-in.submit' | lang" [loading]="busy()" />

      <a class="text-center text-sm text-primary" [routerLink]="cabinetSignIn">{{
        'shell.sign-in.for-candidates' | lang
      }}</a>
    </form>
  `,
})
export default class AdministrativeSignInPage {
  private readonly auth = inject(AuthApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);

  readonly returnUrl = input<string>();
  readonly expired = input<string>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly cabinetSignIn = SIGN_IN_URLS.cabinet;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.session.start(response, 'password');
        void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? homeUrl(this.session.session()));
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorOf(error)?.message ?? this.lang.get('shell.errors.generic'));
      },
    });
  }
}
