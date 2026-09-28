import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import type { Schemas as S } from './api.types';

const BASE = `${environment.API}/oep`;

/**
 * `SignatureController` — ОЭП для членов Совета. Порядок: способ доставки PIN → `send-pin` →
 * `authenticate` (сессия ОЭП с `validUntil`) → `sign` для каждого голоса или решения.
 */
@Injectable({ providedIn: 'root' })
export class OepApi {
  private readonly http = inject(HttpClient);

  methods(): Observable<S['SignatureMethod'][]> {
    return this.http.get<S['SignatureMethod'][]>(`${BASE}/methods`);
  }

  sendPin(method: string): Observable<void> {
    return this.http.post<void>(`${BASE}/send-pin`, { method } satisfies S['SendPinRequest']);
  }

  authenticate(code: string): Observable<S['SessionResponse']> {
    return this.http.post<S['SessionResponse']>(`${BASE}/authenticate`, { code } satisfies S['AuthenticateRequest']);
  }

  session(): Observable<S['SessionResponse']> {
    return this.http.get<S['SessionResponse']>(`${BASE}/session`);
  }

  sign(body: S['SignRequest']): Observable<S['SignatureResponse']> {
    return this.http.post<S['SignatureResponse']>(`${BASE}/sign`, body);
  }
}
