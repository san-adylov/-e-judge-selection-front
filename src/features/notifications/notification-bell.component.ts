import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { OverlayBadge } from 'primeng/overlaybadge';

import { NotificationsStore } from '@domain/stores/notifications.store';

@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, LangPipe, OverlayBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="flex size-10 items-center justify-center rounded-full text-surface-600 hover:bg-surface-100"
      [routerLink]="link()"
      [attr.aria-label]="'shell.notifications.title' | lang"
    >
      @if (store.unread() > 0) {
        <p-overlaybadge severity="danger" size="small" [value]="badge()">
          <i class="pi pi-bell text-xl"></i>
        </p-overlaybadge>
      } @else {
        <i class="pi pi-bell text-xl"></i>
      }
    </a>
  `,
})
export class NotificationBellComponent {
  protected readonly store = inject(NotificationsStore);
  protected readonly badge = computed(() => (this.store.unread() > 99 ? '99+' : String(this.store.unread())));

  /** Страница уведомлений своей зоны: `/cabinet/notifications` или `/administrative/notifications`. */
  readonly link = input.required<string>();
}
