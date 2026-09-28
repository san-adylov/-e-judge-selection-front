import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type MeetingStatus, type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/meeting`;

type Meeting = S['MeetingResponse'];

/**
 * `MeetingController`. Заседание открывает кворум участников (`join`), а не отдельный вызов, как в v1.
 * `POST /meeting` — JSON `ScheduleMeetingRequest` (в v1 — multipart).
 */
@Injectable({ providedIn: 'root' })
export class MeetingsApi {
  private readonly http = inject(HttpClient);

  schedule(body: S['ScheduleMeetingRequest']): Observable<Meeting> {
    return this.http.post<Meeting>(BASE, body);
  }

  reschedule(id: number, body: S['RescheduleMeetingRequest']): Observable<Meeting> {
    return this.http.patch<Meeting>(`${BASE}/${id}`, body);
  }

  join(id: number): Observable<Meeting> {
    return this.http.post<Meeting>(`${BASE}/${id}/join`, null);
  }

  forceClose(id: number): Observable<Meeting> {
    return this.http.put<Meeting>(`${BASE}/${id}/force-close`, null);
  }

  unlockCandidate(meetingId: number, applicationId: number): Observable<void> {
    return this.http.patch<void>(`${BASE}/${meetingId}/candidates/${applicationId}/unlock`, null);
  }

  get(id: number): Observable<Meeting> {
    return this.http.get<Meeting>(`${BASE}/${id}`);
  }

  byContest(contestId: number, query: PageQuery = {}): Observable<Page<Meeting>> {
    return this.http.get<Page<Meeting>>(`${BASE}/by-contest/${contestId}`, { params: toParams(query) });
  }

  /** `status` обязателен; фильтра по типу заседания в v2 нет. */
  byStatus(status: MeetingStatus[], query: PageQuery = {}): Observable<Page<Meeting>> {
    return this.http.get<Page<Meeting>>(BASE, { params: toParams({ status, ...query }) });
  }
}
