import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import { DossierStore } from './dossier.store';

/**
 * Комплектность личного дела (только чтение): что проверит бэкенд при отправке заявки (ошибка 4137).
 * Сами разделы правятся в личном деле — ссылка `profileLink`.
 */
@Component({
  selector: 'app-dossier-check',
  imports: [RouterLink, LangPipe, Button, ButtonDirective, ButtonIcon, ButtonLabel, Message, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <p class="m-0 text-sm text-surface-600">{{ 'wizard.dossier.hint' | lang }}</p>

      @if (store.failed()) {
        <p-message severity="error" [text]="'wizard.dossier-failed' | lang" />
      } @else if (!store.snapshot()) {
        @for (row of [1, 2, 3, 4]; track row) {
          <p-skeleton height="2.75rem" />
        }
      } @else {
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (item of store.items(); track item.key) {
            <li
              class="flex items-center gap-3 rounded-lg border border-surface-200 px-3 py-2.5"
              [class.bg-surface-50]="item.done"
            >
              <i
                class="pi shrink-0"
                [class.pi-check-circle]="item.done"
                [class.text-green-600]="item.done"
                [class.pi-exclamation-circle]="!item.done"
                [class.text-orange-500]="!item.done"
              ></i>
              <span class="min-w-0 flex-1 text-sm">{{ 'wizard.dossier.item.' + item.key | lang }}</span>
              <span class="text-xs text-surface-500">
                {{ (item.done ? 'wizard.dossier.done' : 'wizard.dossier.missing') | lang }}
              </span>
            </li>
          }
        </ul>

        @if (store.complete()) {
          <p-message severity="success" [text]="'wizard.dossier.complete' | lang" />
        } @else {
          <p-message severity="warn" [text]="'wizard.dossier.incomplete' | lang" />
        }
      }

      <div class="flex flex-wrap gap-2">
        <a pButton [outlined]="!store.complete()" [routerLink]="profileLink()">
          <i pButtonIcon class="pi pi-id-card"></i>
          <span pButtonLabel>{{ 'wizard.dossier.open-profile' | lang }}</span>
        </a>
        <p-button
          icon="pi pi-refresh"
          severity="secondary"
          [text]="true"
          [label]="'wizard.dossier.recheck' | lang"
          (onClick)="store.failed() ? store.load() : store.refreshDossier()"
        />
      </div>
    </div>
  `,
})
export class DossierCheckComponent {
  protected readonly store = inject(DossierStore);

  /** Экран личного дела. */
  readonly profileLink = input('/cabinet/profile');
}
