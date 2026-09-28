import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import { type Area, AREAS } from '../../auth/areas';
import { SessionService } from '../../auth/session.service';

/** Переключатель зон для пользователя с ролями Совета и кандидата одновременно. */
@Component({
  selector: 'app-area-switcher',
  imports: [Button, RouterLink, LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session.can('STAFF') && session.can('CANDIDATE')) {
      @if (current() === 'administrative') {
        <p-button
          size="small"
          severity="secondary"
          icon="pi pi-user"
          [text]="true"
          [label]="'shell.area.to-cabinet' | lang"
          [routerLink]="areas.cabinet"
        />
      } @else {
        <p-button
          size="small"
          severity="secondary"
          icon="pi pi-briefcase"
          [text]="true"
          [label]="'shell.area.to-administrative' | lang"
          [routerLink]="areas.administrative"
        />
      }
    }
  `,
})
export class AreaSwitcherComponent {
  protected readonly session = inject(SessionService);
  protected readonly areas = AREAS;

  readonly current = input.required<Area>();
}
