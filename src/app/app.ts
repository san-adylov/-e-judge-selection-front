import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LangService } from '@reforgium/presentia';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';

import { SessionService } from '@shared/auth/session.service';
import { uiLangOf } from '@shared/lib/language';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <p-toast position="top-right" />
    <p-confirmdialog />
  `,
})
export class App {
  constructor() {
    const session = inject(SessionService);
    const lang = inject(LangService);
    let previousUserId: number | null | undefined;

    // Язык по умолчанию — `user.language` с бэкенда: применяется при входе, ручной выбор после этого сохраняется.
    effect(() => {
      const user = session.user();
      const isLogin = previousUserId !== undefined && user !== null && user.id !== previousUserId;

      previousUserId = user?.id ?? null;

      if (isLogin) untracked(() => lang.setLang(uiLangOf(user.language)));
    });
  }
}
