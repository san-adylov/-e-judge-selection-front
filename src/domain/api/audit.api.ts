import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/audit`;

type Entry = S['AuditLogResponse'];

export interface AuditFilter extends PageQuery {
  userId?: number;
  username?: string;
  entityType?: string;
  actionType?: string;
  eventType?: string;
  /** ISO instant. */
  from?: string;
  to?: string;
  success?: boolean;
}

/** `AuditQueryController` (audit-service), только ADMIN. Размер страницы по умолчанию — 50. */
@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);

  list(filter: AuditFilter = {}): Observable<Page<Entry>> {
    return this.http.get<Page<Entry>>(BASE, { params: toParams(filter) });
  }

  ofUser(userId: number, filter: Pick<AuditFilter, 'from' | 'to' | 'page' | 'size'> = {}): Observable<Page<Entry>> {
    return this.http.get<Page<Entry>>(`${BASE}/users/${userId}`, { params: toParams(filter) });
  }
}
