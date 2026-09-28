import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

/** `/forbidden` и 404: `data.code` маршрута — `forbidden` | `not-found`. */
@Component({
  selector: 'app-error-page',
  imports: [RouterLink, LangPipe, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-50 px-4 text-center">
      <i class="pi text-5xl text-primary" [class]="code() === 'forbidden' ? 'pi-lock' : 'pi-compass'"></i>
      <h1 class="m-0 text-2xl font-semibold">{{ 'shell.errors.' + code() + '.title' | lang }}</h1>
      <p class="m-0 max-w-md text-surface-500">{{ 'shell.errors.' + code() + '.text' | lang }}</p>
      <p-button icon="pi pi-home" routerLink="/" [label]="'shell.errors.home' | lang" />
    </main>
  `,
})
export default class ErrorPage {
  readonly code = input<'forbidden' | 'not-found'>('not-found');
}
