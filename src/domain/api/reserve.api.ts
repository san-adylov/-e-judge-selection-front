import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/candidate/reserve`;

type Reserve = S['ReserveResponse'];

/** `ReserveController`: позиции резерва (в v1 — список конкурсов). */
@Injectable({ providedIn: 'root' })
export class ReserveApi {
  private readonly http = inject(HttpClient);

  list(filter: { contestId?: number; status?: Reserve['status'] } & PageQuery = {}): Observable<Page<Reserve>> {
    return this.http.get<Page<Reserve>>(BASE, { params: toParams(filter) });
  }

  my(): Observable<Reserve[]> {
    return this.http.get<Reserve[]>(`${BASE}/my`);
  }

  exclude(id: number, body: S['ExcludeReserveRequest']): Observable<Reserve> {
    return this.http.post<Reserve>(`${BASE}/${id}/exclude`, body);
  }

  confirm(id: number): Observable<Reserve> {
    return this.http.post<Reserve>(`${BASE}/${id}/confirm`, null);
  }

  decline(id: number): Observable<Reserve> {
    return this.http.post<Reserve>(`${BASE}/${id}/decline`, null);
  }
}
