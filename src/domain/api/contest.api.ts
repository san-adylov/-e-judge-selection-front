import { HttpClient, type HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import {
  type ContestStatus,
  type ContestType,
  type Page,
  type PageQuery,
  type Schemas as S,
  type StageKind,
  toParams,
} from './api.types';

const BASE = `${environment.API}/contest`;

type Contest = S['ContestResponse'];

/** `ContestController`. Создание и отмена — председатель, остальные изменения — секретарь. */
@Injectable({ providedIn: 'root' })
export class ContestApi {
  private readonly http = inject(HttpClient);

  createName(body: S['ContestNameRequest']): Observable<Contest> {
    return this.http.post<Contest>(`${BASE}/create-name`, body);
  }

  updateName(id: number, body: S['ContestNameRequest']): Observable<Contest> {
    return this.http.patch<Contest>(`${BASE}/update-name/${id}`, body);
  }

  updateDetails(id: number, body: S['ContestDetailsRequest']): Observable<Contest> {
    return this.http.patch<Contest>(`${BASE}/${id}`, body);
  }

  publish(id: number): Observable<Contest> {
    return this.http.post<Contest>(`${BASE}/${id}/publish`, null);
  }

  /** Отмена конкурса (не удаление записи). */
  cancel(id: number): Observable<Contest> {
    return this.http.delete<Contest>(`${BASE}/${id}`);
  }

  saveSteps(id: number, steps: S['ContestStepRequest'][]): Observable<S['ContestStepResponse'][]> {
    return this.http.put<S['ContestStepResponse'][]>(`${BASE}/steps/${id}`, steps);
  }

  /** По одному этапу за вызов (в v1 — все этапы разом через `PATCH /contest/stages/{id}`). */
  setStageWindow(id: number, stage: StageKind, body: S['StageWindowRequest']): Observable<Contest> {
    return this.http.put<Contest>(`${BASE}/${id}/stage-window/${stage}`, body);
  }

  /** Любому авторизованному (`@AuthenticatedAccess`). Для своей обработки 404 (40413) передайте `skipErrorToast()`. */
  get(id: number, context?: HttpContext): Observable<Contest> {
    return this.http.get<Contest>(`${BASE}/${id}`, { context });
  }

  /** Календарный план конкурса; любому авторизованному. */
  steps(id: number, context?: HttpContext): Observable<S['ContestStepResponse'][]> {
    return this.http.get<S['ContestStepResponse'][]>(`${BASE}/steps/${id}`, { context });
  }

  all(query: PageQuery = {}): Observable<Page<Contest>> {
    return this.http.get<Page<Contest>>(`${BASE}/all`, { params: toParams(query) });
  }

  /** `status` обязателен, можно несколько. */
  byStatus(status: ContestStatus[], query: PageQuery = {}): Observable<Page<Contest>> {
    return this.http.get<Page<Contest>>(BASE, { params: toParams({ status, ...query }) });
  }

  byType(type: ContestType, status: ContestStatus = 'PUBLISHED', query: PageQuery = {}): Observable<Page<Contest>> {
    return this.http.get<Page<Contest>>(`${BASE}/type`, { params: toParams({ type, status, ...query }) });
  }

  completed(query: PageQuery = {}): Observable<Page<Contest>> {
    return this.http.get<Page<Contest>>(`${BASE}/completed`, { params: toParams(query) });
  }

  /** Карточки для кандидата с `visibleStatus` — статус считает бэкенд, не фронт. */
  available(query: PageQuery = {}): Observable<Page<S['ContestCardResponse']>> {
    return this.http.get<Page<S['ContestCardResponse']>>(`${BASE}/available`, { params: toParams(query) });
  }
}
