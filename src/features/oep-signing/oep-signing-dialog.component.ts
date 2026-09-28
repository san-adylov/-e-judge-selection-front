import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputOtp } from 'primeng/inputotp';
import { ProgressSpinner } from 'primeng/progressspinner';
import type { Observable } from 'rxjs';

import type { Schemas as S } from '@domain/api/api.types';
import { OepApi } from '@domain/api/oep.api';

type Phase = 'checking' | 'method' | 'code' | 'signing';

export const OEP_CODE_LENGTH = 6;

/**
 * Подпись ОЭП перед голосом или решением. Если сессия ОЭП активна (`GET /oep/session`), подписывает сразу;
 * иначе: способ доставки PIN → `send-pin` → ввод кода → `authenticate` → `sign`.
 * Использование: `<app-oep-signing-dialog [(visible)]="signing" [context]="{ meetingId, voteId }" (signed)="…" />`.
 */
@Component({
  selector: 'app-oep-signing-dialog',
  imports: [FormsModule, LangPipe, Button, Dialog, InputOtp, ProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      styleClass="w-full max-w-[32rem] mx-4"
      [modal]="true"
      [closeOnEscape]="false"
      [header]="'shell.oep.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      @switch (phase()) {
        @case ('method') {
          <p class="mt-0 text-surface-600">{{ 'shell.oep.choose-method' | lang }}</p>
          <div class="flex flex-col gap-2">
            @for (item of methods(); track item.code) {
              <p-button
                styleClass="w-full justify-start"
                severity="secondary"
                [outlined]="method() !== item.code"
                [label]="item.name ?? item.code ?? ''"
                (onClick)="method.set(item.code ?? null)"
              />
            }
          </div>
          <div class="mt-6 flex justify-end">
            <p-button
              [label]="'shell.oep.send-pin' | lang"
              [disabled]="!method()"
              [loading]="busy()"
              (onClick)="sendPin()"
            />
          </div>
        }
        @case ('code') {
          <p class="mt-0 text-surface-600">{{ 'shell.oep.enter-code' | lang }}</p>
          <div class="flex justify-center">
            <p-inputotp
              [length]="codeLength"
              [integerOnly]="true"
              [ngModel]="code()"
              (ngModelChange)="code.set($event ?? '')"
            />
          </div>
          <div class="mt-6 flex justify-between gap-2">
            <p-button
              severity="secondary"
              [text]="true"
              [label]="'shell.oep.resend' | lang"
              (onClick)="loadMethods()"
            />
            <p-button
              [label]="'shell.oep.sign' | lang"
              [disabled]="code().length !== codeLength"
              [loading]="busy()"
              (onClick)="authenticate()"
            />
          </div>
        }
        @default {
          <div class="flex flex-col items-center gap-3 py-6 text-surface-600">
            <p-progress-spinner strokeWidth="4" styleClass="!size-12" />
            <span>{{ (phase() === 'signing' ? 'shell.oep.signing' : 'shell.oep.checking') | lang }}</span>
          </div>
        }
      }
    </p-dialog>
  `,
})
export class OepSigningDialogComponent {
  private readonly api = inject(OepApi);
  protected readonly codeLength = OEP_CODE_LENGTH;

  readonly visible = model(false);
  /** Что подписываем: заседание, заявка, заявка судьи, голос. */
  readonly context = input.required<S['SignRequest']>();
  readonly signed = output<S['SignatureResponse']>();

  protected readonly phase = signal<Phase>('checking');
  protected readonly methods = signal<S['SignatureMethod'][]>([]);
  protected readonly method = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) untracked(() => this.begin());
    });
  }

  protected loadMethods(): void {
    this.code.set('');
    this.run(this.api.methods(), (methods) => {
      this.methods.set(methods);
      this.method.set(methods[0]?.code ?? null);
      this.phase.set('method');
    });
  }

  protected sendPin(): void {
    const method = this.method();

    if (method) this.run(this.api.sendPin(method), () => this.phase.set('code'));
  }

  protected authenticate(): void {
    this.run(this.api.authenticate(this.code()), (session) => (session.active ? this.sign() : this.code.set('')));
  }

  private begin(): void {
    this.phase.set('checking');
    this.run(this.api.session(), (session) => (session.active ? this.sign() : this.loadMethods()));
  }

  private sign(): void {
    this.phase.set('signing');
    this.run(this.api.sign(this.context()), (signature) => {
      this.signed.emit(signature);
      this.visible.set(false);
    });
  }

  /** Ошибку показывает тост из interceptor; диалог остаётся на текущем шаге. */
  private run<T>(request: Observable<T>, next: (value: T) => void): void {
    this.busy.set(true);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        next(value);
      },
      error: () => {
        this.busy.set(false);

        if (this.phase() === 'checking' || this.phase() === 'signing') this.visible.set(false);
      },
    });
  }
}
