import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/contest-results`;

type Entry = S['RatingEntryResponse'];

/** `ContestResultsController`: рейтинг, прошедшие, резерв, готовность к закрытию конкурса. */
@Injectable({ providedIn: 'root' })
export class ContestResultsApi {
  private readonly http = inject(HttpClient);

  rating(contestId: number, activeOnly = false): Observable<S['ContestRatingResponse']> {
    return this.http.get<S['ContestRatingResponse']>(`${BASE}/${contestId}/rating`, {
      params: toParams({ activeOnly }),
    });
  }

  results(contestId: number): Observable<Entry[]> {
    return this.http.get<Entry[]>(`${BASE}/${contestId}/results`);
  }

  passedCandidates(contestId: number): Observable<Entry[]> {
    return this.http.get<Entry[]>(`${BASE}/${contestId}/passed-candidates`);
  }

  reserveCandidates(contestId: number): Observable<Entry[]> {
    return this.http.get<Entry[]>(`${BASE}/${contestId}/reserve-candidates`);
  }

  my(): Observable<Entry[]> {
    return this.http.get<Entry[]>(`${BASE}/my`);
  }

  completedMy(): Observable<S['PassedContestResponse'][]> {
    return this.http.get<S['PassedContestResponse'][]>(`${BASE}/completed/my`);
  }

  readiness(contestId: number): Observable<S['CompletionReadinessResponse']> {
    return this.http.get<S['CompletionReadinessResponse']>(`${BASE}/${contestId}/readiness`);
  }

  reserveList(contestId: number): Observable<S['StoredFileRef']> {
    return this.http.post<S['StoredFileRef']>(`${BASE}/${contestId}/reserve-list`, null);
  }
}
