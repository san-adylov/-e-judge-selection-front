import { HttpClient, type HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/questions`;

type Question = S['QuestionResponse'];

/**
 * `QuestionController` — банк вопросов. Категории фиксированы (`QuestionCategoryCode`):
 * создать и удалить категорию нельзя, только изменить.
 */
@Injectable({ providedIn: 'root' })
export class QuestionsApi {
  private readonly http = inject(HttpClient);

  create(body: S['QuestionRequest']): Observable<Question> {
    return this.http.post<Question>(BASE, body);
  }

  update(id: number, body: S['QuestionRequest']): Observable<Question> {
    return this.http.put<Question>(`${BASE}/${id}`, body);
  }

  activate(id: number): Observable<Question> {
    return this.http.patch<Question>(`${BASE}/${id}/activate`, null);
  }

  deactivate(id: number): Observable<Question> {
    return this.http.patch<Question>(`${BASE}/${id}/deactivate`, null);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`);
  }

  get(id: number): Observable<Question> {
    return this.http.get<Question>(`${BASE}/${id}`);
  }

  /** `categoryId` обязателен. */
  byCategory(categoryId: number, query: PageQuery = {}): Observable<Page<Question>> {
    return this.http.get<Page<Question>>(BASE, { params: toParams({ categoryId, ...query }) });
  }

  categories(): Observable<S['QuestionCategoryResponse'][]> {
    return this.http.get<S['QuestionCategoryResponse'][]>(`${BASE}/categories`);
  }

  updateCategory(id: number, body: S['QuestionCategoryRequest']): Observable<S['QuestionCategoryResponse']> {
    return this.http.put<S['QuestionCategoryResponse']>(`${BASE}/categories/${id}`, body);
  }

  importTemplate(): Observable<HttpResponse<Blob>> {
    return this.http.get(`${BASE}/import/template`, { observe: 'response', responseType: 'blob' });
  }

  import(file: File): Observable<S['ImportReport']> {
    const body = new FormData();

    body.append('file', file, file.name);

    return this.http.post<S['ImportReport']>(`${BASE}/import`, body);
  }
}
