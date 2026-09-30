import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import { SessionService } from '@shared/auth/session.service';

/**
 * «Выйти» на экранах этапа (итог, ошибка загрузки) — одна кнопка для теста и эссе.
 * `exiting` приходит перед выходом: экран успевает убрать то, что хранит на устройстве.
 */
@Component({
  selector: 'app-stage-exit',
  imports: [LangPipe, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full tablet:w-auto' },
  template: `
    <p-button
      styleClass="w-full tablet:w-auto"
      icon="pi pi-sign-out"
      [severity]="primary() ? 'primary' : 'secondary'"
      [outlined]="!primary()"
      [label]="'shell.logout' | lang"
      [loading]="leaving()"
      (onClick)="exit()"
    />
  `,
})
export class StageExitComponent {
  private readonly session = inject(SessionService);

  /** Главное действие экрана (итог) или второстепенное (рядом с «Повторить»). */
  readonly primary = input(false);
  readonly exiting = output<void>();

  protected readonly leaving = signal(false);

  protected async exit(): Promise<void> {
    if (this.leaving()) return;

    this.leaving.set(true);
    this.exiting.emit();

    try {
      await this.session.logout();
    } finally {
      this.leaving.set(false);
    }
  }
}
