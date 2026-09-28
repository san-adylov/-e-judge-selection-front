import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { InputOtp } from 'primeng/inputotp';
import { Message } from 'primeng/message';

import { AuthApi } from '@domain/api/auth.api';
import { apiErrorOf } from '@shared/api/api-error';
import { homeUrl } from '@shared/auth/areas';
import { SessionService } from '@shared/auth/session.service';
import { stageCodeValidator } from '@shared/lib/validators';

/** Вход на этап (тест или эссе) по коду из 6 символов `[A-Za-z0-9]`. */
@Component({
  selector: 'app-testing-sign-in',
  imports: [ReactiveFormsModule, LangPipe, Button, InputOtp, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-5" (ngSubmit)="submit()">
      <div class="flex flex-col items-center gap-3 text-center">
        <img src="/logo.svg" alt="" class="size-16" />
        <h1 class="m-0 text-2xl font-semibold">{{ 'shell.sign-in.testing' | lang }}</h1>
        <p class="m-0 text-sm text-surface-500">{{ 'shell.sign-in.testing-hint' | lang }}</p>
      </div>

      @if (error()) {
        <p-message severity="error" [text]="error()!" />
      }

      <div class="flex justify-center">
        <p-inputotp [length]="6" [formControl]="code" />
      </div>

      <p-button
        type="submit"
        styleClass="w-full"
        [label]="'shell.sign-in.submit' | lang"
        [disabled]="code.invalid"
        [loading]="busy()"
      />
    </form>
  `,
})
export default class TestingSignInPage {
  private readonly auth = inject(AuthApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, stageCodeValidator],
  });

  protected submit(): void {
    if (this.code.invalid) return;

    this.busy.set(true);
    this.error.set(null);
    this.auth.otpLogin(this.code.value).subscribe({
      next: (response) => {
        this.session.start(response, 'stage-code');
        void this.router.navigateByUrl(homeUrl(this.session.session()));
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorOf(error)?.message ?? this.lang.get('shell.errors.generic'));
      },
    });
  }
}
