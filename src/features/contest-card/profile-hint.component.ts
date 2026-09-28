import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Message } from 'primeng/message';

/** Подсказка при отказе 4137: личное дело не заполнено — ссылка в `/cabinet/profile`. */
@Component({
  selector: 'app-contest-profile-hint',
  imports: [RouterLink, LangPipe, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-message severity="warn" icon="pi pi-user-edit">
      <span class="text-sm">
        {{ 'contests.apply.profile-hint' | lang }}
        <a routerLink="/cabinet/profile" class="font-medium text-primary hover:underline">
          {{ 'contests.apply.profile-link' | lang }}
        </a>
      </span>
    </p-message>
  `,
})
export class ContestProfileHintComponent {}
