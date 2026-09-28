import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Message } from 'primeng/message';

import type { Schemas } from '@domain/api/api.types';
import { LocalDatePipe } from '@shared/lib/format.pipes';

/** Блокирующее сообщение об отстранении от участия (`GET /v1/candidate/ban-status`, отказ 4153). */
@Component({
  selector: 'app-contest-ban-message',
  imports: [LangPipe, LocalDatePipe, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-message severity="error" icon="pi pi-ban">
      <span class="text-sm">
        @if (ban().bannedUntil) {
          {{ 'contests.ban.until' | lang: { date: (ban().bannedUntil | localDate) } }}
        } @else {
          {{ 'contests.ban.message' | lang }}
        }
      </span>
    </p-message>
  `,
})
export class ContestBanMessageComponent {
  readonly ban = input.required<Schemas['BanStatusResponse']>();
}
