import { HttpClient, type HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/tests`;

type TestView = S['TestViewResponse'];

/**
 * `TestController`. `testId` — `exerciseId` из токена этапа.
 * Тест стартует при вводе кода этапа (`OtpValidationService` → `startOrResume`), отдельного «начать» нет.
 * `context` — например `skipErrorToast()`, когда экран сам показывает ошибку.
 */
@Injectable({ providedIn: 'root' })
export class TestsApi {
  private readonly http = inject(HttpClient);

  /** Коды этапов TEST и ESSAY для кандидатов (в v1 — `POST /notifications/stage`). */
  issueCodes(body: S['IssueCodesRequest']): Observable<S['IssuedCodeResponse'][]> {
    return this.http.post<S['IssuedCodeResponse'][]>(`${BASE}/codes/issue`, body);
  }

  /** Вопросы без правильных ответов, сохранённые выборы и `remainingSeconds` по часам сервера. */
  view(testId: number, context?: HttpContext): Observable<TestView> {
    return this.http.get<TestView>(`${BASE}/${testId}`, { context });
  }

  /**
   * Ответ на вопрос сохраняется один раз: повтор — 4116, после истечения времени — 4133
   * (тест при этом завершается), завершённый тест — 4118. В ответе — актуальный `TestViewResponse`.
   */
  answer(testId: number, questionNumber: number, optionIds: number[], context?: HttpContext): Observable<TestView> {
    return this.http.post<TestView>(
      `${BASE}/${testId}/questions/${questionNumber}/answer`,
      { optionIds } satisfies S['AnswerRequest'],
      { context },
    );
  }

  /** Завершение и подсчёт результата; повторное завершение — 4118. */
  finish(testId: number, context?: HttpContext): Observable<S['TestResultResponse']> {
    return this.http.post<S['TestResultResponse']>(`${BASE}/${testId}/finish`, null, { context });
  }

  /** Результат завершённого теста; незавершённый — 4119. */
  result(testId: number, context?: HttpContext): Observable<S['TestResultResponse']> {
    return this.http.get<S['TestResultResponse']>(`${BASE}/${testId}/result`, { context });
  }

  list(query: PageQuery = {}): Observable<Page<S['TestSummaryResponse']>> {
    return this.http.get<Page<S['TestSummaryResponse']>>(BASE, { params: toParams(query) });
  }

  review(testId: number): Observable<S['TestReviewResponse']> {
    return this.http.get<S['TestReviewResponse']>(`${BASE}/${testId}/review`);
  }
}
