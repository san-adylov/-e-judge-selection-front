import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type OnInit } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';

import type { Schemas } from '@domain/api/api.types';
import { NotificationsStore } from '@domain/stores/notifications.store';
import { localized } from '@shared/lib/language';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

/** Один экран уведомлений для всех ролей (`/cabinet/notifications`, `/administrative/notifications`). */
@Component({
  selector: 'app-notifications-page',
  imports: [DatePipe, LangPipe, Button, Paginator, Skeleton, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="shell.notifications.title">
      <p-button
        icon="pi pi-check-square"
        severity="secondary"
        [outlined]="true"
        [label]="'shell.notifications.read-all' | lang"
        [disabled]="store.unread() === 0"
        (onClick)="store.markAllRead()"
      />
    </app-page-header>

    <section class="max-w-4xl overflow-hidden rounded-xl border border-surface-200 bg-surface-0">
      @if (store.loading() && !store.items().length) {
        @for (row of [1, 2, 3]; track row) {
          <div class="border-b border-surface-100 p-4"><p-skeleton height="2.5rem" /></div>
        }
      } @else {
        @for (item of store.items(); track item.id) {
          <button
            type="button"
            class="flex w-full gap-3 border-0 border-b border-surface-100 bg-transparent p-4 text-left last:border-b-0 hover:bg-surface-50"
            [class.font-semibold]="!item.read"
            (click)="open(item)"
          >
            <span class="mt-1.5 size-2 shrink-0 rounded-full" [class.bg-primary]="!item.read"></span>
            <span class="flex min-w-0 flex-1 flex-col gap-1">
              @if (item.title) {
                <span>{{ item.title }}</span>
              }
              <span class="text-sm font-normal text-surface-700">{{ message(item) }}</span>
              <span class="text-xs font-normal text-surface-500">{{ item.createdAt | date: 'dd.MM.yyyy HH:mm' }}</span>
            </span>
          </button>
        } @empty {
          <p class="m-0 p-8 text-center text-surface-500">{{ 'shell.notifications.empty' | lang }}</p>
        }
      }
    </section>

    @if (store.total() > store.size()) {
      <p-paginator
        class="mt-4 block max-w-4xl"
        [rows]="store.size()"
        [first]="store.page() * store.size()"
        [totalRecords]="store.total()"
        (onPageChange)="onPage($event)"
      />
    }
  `,
})
export class NotificationsPageComponent implements OnInit {
  protected readonly store = inject(NotificationsStore);
  private readonly lang = inject(LangService);

  ngOnInit(): void {
    this.store.load(0);
  }

  protected message(item: Schemas['NotificationResponse']): string {
    return localized(item.messageRu, item.messageKg, this.lang.currentLang());
  }

  protected open(item: Schemas['NotificationResponse']): void {
    if (!item.read && item.id !== undefined) this.store.markRead(item.id);
  }

  protected onPage(state: PaginatorState): void {
    const size = state.rows ?? this.store.size();

    this.store.load(Math.floor((state.first ?? 0) / size), size);
  }
}
