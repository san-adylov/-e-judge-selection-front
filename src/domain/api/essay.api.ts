import { HttpClient, type HttpContext, type HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/essay`;

type Submission = S['EssaySubmissionResponse'];
type Topic = S['EssayTopicResponse'];

/** Ответ вместе со временем сервера из заголовка `Date` (мс с эпохи; `null`, если заголовка нет). */
export interface Timed<T> {
  body: T;
  serverTime: number | null;
}

/** Время сервера из заголовка `Date` (точность — секунда). */
export function serverTimeOf(headers: HttpHeaders): number | null {
  const value = headers.get('Date');
  const time = value ? Date.parse(value) : Number.NaN;

  return Number.isNaN(time) ? null : time;
}

/** `EssayCandidateController` + `EssayReviewController` + `EssayTopicController`. */
@Injectable({ providedIn: 'root' })
export class EssayApi {
  private readonly http = inject(HttpClient);

  /**
   * Своя работа: тема, срок, ответы (они приходят только после отправки). С токеном этапа `exerciseId` —
   * это id работы (`EssaySubmission`), `applicationId` не нужен; с обычным токеном кандидата — обязателен.
   */
  my(applicationId?: number): Observable<Submission> {
    return this.http.get<Submission>(`${BASE}/my`, { params: toParams({ applicationId }) });
  }

  /** То же, что `my()`, плюс время сервера — таймер не зависит от часов устройства. */
  myTimed(applicationId?: number): Observable<Timed<Submission>> {
    return this.http
      .get<Submission>(`${BASE}/my`, { params: toParams({ applicationId }), observe: 'response' })
      .pipe(map((response) => ({ body: response.body ?? {}, serverTime: serverTimeOf(response.headers) })));
  }

  /**
   * Все ответы разом и только один раз: повтор → 4135, после срока → 4313. Черновиков на сервере нет.
   * `context` — например, `skipErrorToast()` для автоотправки с повторами.
   */
  reply(body: S['EssayReplyRequest'], applicationId?: number, context?: HttpContext): Observable<Submission> {
    return this.http.put<Submission>(`${BASE}/my/reply`, body, {
      params: toParams({ applicationId }),
      ...(context ? { context } : {}),
    });
  }

  /** Очередь эссе на проверку текущему члену Совета. */
  reviewQueue(contestId: number, query: PageQuery = {}): Observable<Page<Submission>> {
    return this.http.get<Page<Submission>>(`${BASE}/reply`, { params: toParams({ contestId, ...query }) });
  }

  allReplies(contestId: number, query: PageQuery = {}): Observable<Page<Submission>> {
    return this.http.get<Page<Submission>>(`${BASE}/reply/all`, { params: toParams({ contestId, ...query }) });
  }

  replyById(submissionId: number): Observable<Submission> {
    return this.http.get<Submission>(`${BASE}/reply/${submissionId}`);
  }

  score(submissionId: number, body: S['EssayScoreRequest']): Observable<Submission> {
    return this.http.put<Submission>(`${BASE}/reply/${submissionId}/score`, body);
  }

  progress(contestId: number): Observable<S['ReviewerProgressResponse'][]> {
    return this.http.get<S['ReviewerProgressResponse'][]>(`${BASE}/reply/progress`, {
      params: toParams({ contestId }),
    });
  }

  topics(): Observable<Topic[]> {
    return this.http.get<Topic[]>(`${BASE}/topic`);
  }

  topic(id: number): Observable<Topic> {
    return this.http.get<Topic>(`${BASE}/topic/${id}`);
  }

  createTopic(body: S['EssayTopicRequest']): Observable<Topic> {
    return this.http.post<Topic>(`${BASE}/topic`, body);
  }

  updateTopic(id: number, body: S['EssayTopicRequest']): Observable<Topic> {
    return this.http.put<Topic>(`${BASE}/topic/${id}`, body);
  }

  /** Деактивация темы, 204. */
  removeTopic(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/topic/${id}`);
  }
}
