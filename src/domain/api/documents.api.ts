import { HttpClient, type HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import type { Schemas as S } from './api.types';

const DECISIONS = `${environment.API}/decision`;
const DOCUMENTS = `${environment.API}/documents`;

type Decision = S['DecisionResponse'];

/**
 * `DecisionController` + `DocumentController`. Решения в v2 создаёт система (`generate`),
 * шесть маршрутов `/pdf-file/*` v1 уходят.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly http = inject(HttpClient);

  decisionsByApplication(applicationId: number): Observable<Decision[]> {
    return this.http.get<Decision[]>(`${DECISIONS}/by-application/${applicationId}`);
  }

  decisionsByMeeting(meetingId: number): Observable<Decision[]> {
    return this.http.get<Decision[]>(`${DECISIONS}/by-meeting/${meetingId}`);
  }

  /** `extra` — дополнительные поля шаблона, например `reason`. */
  generateDecision(id: number, extra?: Record<string, unknown>): Observable<Decision> {
    return this.http.post<Decision>(`${DECISIONS}/${id}/generate`, extra ?? null);
  }

  confirmDecision(id: number): Observable<Decision> {
    return this.http.post<Decision>(`${DECISIONS}/${id}/confirm`, null);
  }

  downloadDecision(id: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${DECISIONS}/${id}/download`, { observe: 'response', responseType: 'blob' });
  }

  /** Типы: `ADMISSION`, `NON_ADMISSION`, `CANDIDATE_PRESENTATION`; иначе 4066. */
  generate(body: S['GenerateDocumentRequest']): Observable<S['StoredFileRef']> {
    return this.http.post<S['StoredFileRef']>(`${DOCUMENTS}/generate`, body);
  }

  download(fileId: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${DOCUMENTS}/${fileId}/download`, { observe: 'response', responseType: 'blob' });
  }
}
