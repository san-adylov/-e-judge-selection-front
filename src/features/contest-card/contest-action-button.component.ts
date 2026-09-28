import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import type { ContestAction } from './contest-action';

/**
 * Кнопка действия по конкурсу — одна для карточки и детальной страницы:
 * «Подать заявку», «Моя заявка» или неактивная кнопка с причиной.
 */
@Component({
  selector: 'app-contest-action-button',
  imports: [RouterLink, LangPipe, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @switch (action().kind) {
      @case ('apply') {
        <p-button
          icon="pi pi-send"
          styleClass="w-full"
          [label]="'contests.action.apply' | lang"
          [loading]="loading()"
          [disabled]="disabled()"
          (onClick)="apply.emit()"
        />
      }
      @case ('application') {
        <p-button
          icon="pi pi-file"
          severity="secondary"
          styleClass="w-full"
          [label]="'contests.action.my-application' | lang"
          [routerLink]="applicationLink()"
        />
      }
      @default {
        <p-button
          severity="secondary"
          styleClass="w-full"
          [outlined]="true"
          [disabled]="true"
          [label]="'contests.action.' + reason() | lang"
        />
      }
    }
  `,
})
export class ContestActionButtonComponent {
  readonly action = input.required<ContestAction>();
  /** Без id заявки «Моя заявка» ведёт в список заявок. */
  readonly applicationId = input<number | null | undefined>(null);
  readonly loading = input(false);
  /** Идёт подача по другому конкурсу. */
  readonly disabled = input(false);
  readonly apply = output();

  protected readonly reason = computed(() => {
    const action = this.action();

    return action.kind === 'unavailable' ? action.reason : '';
  });

  protected readonly applicationLink = computed(() => {
    const id = this.applicationId();

    return id == null ? ['/cabinet/applications'] : ['/cabinet/applications', id];
  });
}
