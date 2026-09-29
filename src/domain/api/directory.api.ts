import { HttpClient, type HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type DirectoryCode, type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/directory`;

type Item = S['DirectoryItemResponse'];

export interface DirectoryQuery extends PageQuery {
  parentId?: number;
  search?: string;
  activeOnly?: boolean;
}

/** `DirectoryController`: все справочники v1 (`/cities`, `/hb-*`, …) → `/v1/directory/{CODE}`. */
@Injectable({ providedIn: 'root' })
export class DirectoryApi {
  private readonly http = inject(HttpClient);

  codes(): Observable<DirectoryCode[]> {
    return this.http.get<DirectoryCode[]>(BASE);
  }

  page(code: DirectoryCode, query: DirectoryQuery = {}): Observable<Page<Item>> {
    return this.http.get<Page<Item>>(`${BASE}/${code}`, { params: toParams(query) });
  }

  all(code: DirectoryCode): Observable<Item[]> {
    return this.http.get<Item[]>(`${BASE}/${code}/all`);
  }

  /** Запись по id, в том числе выключенная (`/all` отдаёт только активные); любому авторизованному. */
  get(code: DirectoryCode, id: number, context?: HttpContext): Observable<Item> {
    return this.http.get<Item>(`${BASE}/${code}/${id}`, { context });
  }

  create(code: DirectoryCode, body: S['DirectoryItemRequest']): Observable<Item> {
    return this.http.post<Item>(`${BASE}/${code}`, body);
  }

  update(code: DirectoryCode, id: number, body: S['DirectoryItemRequest']): Observable<Item> {
    return this.http.put<Item>(`${BASE}/${code}/${id}`, body);
  }

  setActive(code: DirectoryCode, id: number, active: boolean): Observable<Item> {
    return this.http.patch<Item>(`${BASE}/${code}/${id}/active`, null, { params: toParams({ active }) });
  }

  sortOrder(code: DirectoryCode, items: S['SortOrderRequest'][]): Observable<void> {
    return this.http.put<void>(`${BASE}/${code}/sort-order`, items);
  }

  /** Синхронизация справочников из внешнего источника (коды до `UNIVERSITY`). */
  sync(code: DirectoryCode): Observable<{ created: number; updated: number; deactivated: number }> {
    return this.http.post<{ created: number; updated: number; deactivated: number }>(`${BASE}/${code}/sync`, null);
  }
}
