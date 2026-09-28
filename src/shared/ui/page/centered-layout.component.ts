import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LangSwitcherComponent } from '../layout/lang-switcher.component';

/** Каркас страниц входа. */
@Component({
  selector: 'app-centered-layout',
  imports: [RouterOutlet, LangSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-gradient-to-br from-primary-900 to-primary-700 px-4">
      <div class="flex justify-end py-4">
        <app-lang-switcher />
      </div>
      <main class="flex flex-1 items-start justify-center pb-10 pt-4 tablet:items-center">
        <div class="w-full max-w-md rounded-2xl bg-surface-0 p-6 shadow-xl tablet:p-8">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class CenteredLayoutComponent {}
