import { HttpClient, type HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type ApplicationStatus, type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/contest-application`;

type Application = S['ApplicationResponse'];

/** `ApplicationController`: заявки кандидатов на конкурс. */
@Injectable({ providedIn: 'root' })
export class ContestApplicationApi {
  private readonly http = inject(HttpClient);

  create(contestId: number, body: S['ApplicationDraftRequest']): Observable<Application> {
    return this.http.post<Application>(`${BASE}/contest/${contestId}`, body);
  }

  update(id: number, body: S['ApplicationDraftRequest']): Observable<Application> {
    return this.http.patch<Application>(`${BASE}/${id}`, body);
  }

  sendForReview(id: number): Observable<Application> {
    return this.http.post<Application>(`${BASE}/send-for-review/${id}`, null);
  }

  withdraw(id: number): Observable<Application> {
    return this.http.post<Application>(`${BASE}/withdraw/${id}`, null);
  }

  register(id: number): Observable<Application> {
    return this.http.put<Application>(`${BASE}/register/${id}`, null);
  }

  returnForCorrection(id: number, body: S['ReturnForCorrectionRequest']): Observable<Application> {
    return this.http.put<Application>(`${BASE}/returned-for-correction/${id}`, body);
  }

  cancel(id: number): Observable<Application> {
    return this.http.post<Application>(`${BASE}/canceled/${id}`, null);
  }

  assignBoardMember(id: number, boardMemberId: number): Observable<Application> {
    return this.http.put<Application>(`${BASE}/assign-board-member/${id}`, null, {
      params: toParams({ boardMemberId }),
    });
  }

  setReady(id: number, body: S['ReadyRequest']): Observable<Application> {
    return this.http.patch<Application>(`${BASE}/${id}/ready`, body);
  }

  readiness(contestId: number): Observable<S['ReporterReadinessResponse']> {
    return this.http.get<S['ReporterReadinessResponse']>(`${BASE}/ready`, { params: toParams({ contestId }) });
  }

  /** Чужая заявка — 403, несуществующая — 404: для своей обработки передайте `skipErrorToast()`. */
  get(id: number, context?: HttpContext): Observable<Application> {
    return this.http.get<Application>(`${BASE}/${id}`, { context });
  }

  history(id: number): Observable<S['ApplicationStatusHistoryResponse'][]> {
    return this.http.get<S['ApplicationStatusHistoryResponse'][]>(`${BASE}/${id}/history`);
  }

  /** Все заявки кандидата страницей (в v1 — одна заявка по `contestId`). */
  my(query: PageQuery = {}): Observable<Page<Application>> {
    return this.http.get<Page<Application>>(`${BASE}/my`, { params: toParams(query) });
  }

  forSecretary(contestId: number, query: PageQuery = {}): Observable<Page<Application>> {
    return this.http.get<Page<Application>>(`${BASE}/for-secretary`, { params: toParams({ contestId, ...query }) });
  }

  /** `status` обязателен, можно несколько. */
  byContest(contestId: number, status: ApplicationStatus[], query: PageQuery = {}): Observable<Page<Application>> {
    return this.http.get<Page<Application>>(`${BASE}/by-contest/${contestId}`, {
      params: toParams({ status, ...query }),
    });
  }

  myReporting(contestId: number): Observable<Application[]> {
    return this.http.get<Application[]>(`${BASE}/my-reporting`, { params: toParams({ contestId }) });
  }
}
