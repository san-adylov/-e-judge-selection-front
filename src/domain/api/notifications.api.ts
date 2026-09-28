import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { skipErrorToast } from '@shared/api/http-context';
import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/notifications`;

type Notification = S['NotificationResponse'];

/** `NotificationController`. О новых уведомлениях сообщает SSE-событие `notification`. */
@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);

  list(query: PageQuery = {}): Observable<Page<Notification>> {
    return this.http.get<Page<Notification>>(BASE, { params: toParams(query) });
  }

  /** Фоновый запрос колокольчика — без тоста при ошибке. */
  unreadCount(): Observable<S['UnreadCountResponse']> {
    return this.http.get<S['UnreadCountResponse']>(`${BASE}/unread-count`, { context: skipErrorToast() });
  }

  markRead(id: number): Observable<Notification> {
    return this.http.patch<Notification>(`${BASE}/${id}/read`, null);
  }

  markAllRead(): Observable<{ updated: number }> {
    return this.http.patch<{ updated: number }>(`${BASE}/read-all`, null);
  }

  /** Приглашение на собеседование (в v1 — `POST /notifications/stage` с типом INTERVIEW). */
  inviteInterview(body: S['InterviewInvitationRequest']): Observable<{ invited: number }> {
    return this.http.post<{ invited: number }>(`${BASE}/interview-invitation`, body);
  }
}
