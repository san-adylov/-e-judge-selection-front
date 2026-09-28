import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/tests`;

type TestView = S['TestViewResponse'];

/** `TestController`. `testId` — `exerciseId` из токена этапа. */
@Injectable({ providedIn: 'root' })
export class TestsApi {
  private readonly http = inject(HttpClient);

  /** Коды этапов TEST и ESSAY для кандидатов (в v1 — `POST /notifications/stage`). */
  issueCodes(body: S['IssueCodesRequest']): Observable<S['IssuedCodeResponse'][]> {
    return this.http.post<S['IssuedCodeResponse'][]>(`${BASE}/codes/issue`, body);
  }

  view(testId: number): Observable<TestView> {
    return this.http.get<TestView>(`${BASE}/${testId}`);
  }

  answer(testId: number, questionNumber: number, optionIds: number[]): Observable<TestView> {
    return this.http.post<TestView>(`${BASE}/${testId}/questions/${questionNumber}/answer`, {
      optionIds,
    } satisfies S['AnswerRequest']);
  }

  finish(testId: number): Observable<S['TestResultResponse']> {
    return this.http.post<S['TestResultResponse']>(`${BASE}/${testId}/finish`, null);
  }

  result(testId: number): Observable<S['TestResultResponse']> {
    return this.http.get<S['TestResultResponse']>(`${BASE}/${testId}/result`);
  }

  list(query: PageQuery = {}): Observable<Page<S['TestSummaryResponse']>> {
    return this.http.get<Page<S['TestSummaryResponse']>>(BASE, { params: toParams(query) });
  }

  review(testId: number): Observable<S['TestReviewResponse']> {
    return this.http.get<S['TestReviewResponse']>(`${BASE}/${testId}/review`);
  }
}
