import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/essay`;

type Submission = S['EssaySubmissionResponse'];
type Topic = S['EssayTopicResponse'];

/** `EssayCandidateController` + `EssayReviewController` + `EssayTopicController`. */
@Injectable({ providedIn: 'root' })
export class EssayApi {
  private readonly http = inject(HttpClient);

  my(applicationId?: number): Observable<Submission> {
    return this.http.get<Submission>(`${BASE}/my`, { params: toParams({ applicationId }) });
  }

  reply(body: S['EssayReplyRequest'], applicationId?: number): Observable<Submission> {
    return this.http.put<Submission>(`${BASE}/my/reply`, body, { params: toParams({ applicationId }) });
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
