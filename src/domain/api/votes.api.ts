import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/vote`;

/**
 * `VoteController` — один маршрут для всех голосований (конкурс, вакансия, жалоба).
 * `subjectId` обязателен; голос «против» требует причину (4009). Перед голосом — подпись ОЭП.
 */
@Injectable({ providedIn: 'root' })
export class VotesApi {
  private readonly http = inject(HttpClient);

  cast(body: S['CastVoteRequest']): Observable<S['VoteResponse']> {
    return this.http.post<S['VoteResponse']>(BASE, body);
  }

  list(meetingId: number, subjectId?: number): Observable<S['VoteResponse'][]> {
    return this.http.get<S['VoteResponse'][]>(`${BASE}/${meetingId}`, { params: toParams({ subjectId }) });
  }

  summary(meetingId: number, subjectId?: number): Observable<S['VoteSummaryResponse']> {
    return this.http.get<S['VoteSummaryResponse']>(`${BASE}/${meetingId}/summary`, { params: toParams({ subjectId }) });
  }
}
