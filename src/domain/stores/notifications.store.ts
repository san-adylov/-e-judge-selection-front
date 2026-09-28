import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { Subscription } from 'rxjs';

import { SseService } from '@shared/api/sse.service';
import { SessionService } from '@shared/auth/session.service';

import type { Schemas as S } from '../api/api.types';
import { NotificationsApi } from '../api/notifications.api';

type Notification = S['NotificationResponse'];

/**
 * Уведомления текущего пользователя. Вместо опроса каждые 30 с (v1) — начальная загрузка
 * и перезапрос по SSE-событию `notification`. Для токена этапа (тестирование) не запускается.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly api = inject(NotificationsApi);
  private readonly session = inject(SessionService);
  private readonly sse = inject(SseService);
  private events: Subscription | null = null;

  readonly unread = signal(0);
  readonly items = signal<Notification[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly loading = signal(false);
  private listLoaded = false;

  constructor() {
    effect(() => {
      const active = this.session.isAuthenticated() && !this.session.stage();

      untracked(() => (active ? this.start() : this.stop()));
    });
  }

  load(page = this.page(), size = this.size()): void {
    this.loading.set(true);
    this.api.list({ page, size, sort: 'createdAt,desc' }).subscribe({
      next: (result) => {
        this.items.set(result.content);
        this.total.set(result.totalElements);
        this.page.set(result.page);
        this.size.set(result.size);
        this.listLoaded = true;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  refreshCount(): void {
    this.api
      .unreadCount()
      .subscribe({ next: (response) => this.unread.set(response.unread ?? 0), error: () => undefined });
  }

  markRead(id: number): void {
    this.api.markRead(id).subscribe((updated) => {
      this.items.update((items) => items.map((item) => (item.id === id ? updated : item)));
      this.refreshCount();
    });
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe(() => {
      this.items.update((items) => items.map((item) => ({ ...item, read: true })));
      this.unread.set(0);
    });
  }

  private start(): void {
    if (this.events) return;

    this.refreshCount();
    this.events = this.sse.on('notification').subscribe(() => {
      this.refreshCount();

      if (this.listLoaded) this.load();
    });
  }

  private stop(): void {
    this.events?.unsubscribe();
    this.events = null;
    this.listLoaded = false;
    this.unread.set(0);
    this.items.set([]);
    this.total.set(0);
  }
}
