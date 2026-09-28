import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const DOCUMENTS = `${environment.API}/document-assessment`;
const INTERVIEWS = `${environment.API}/interviews`;

/** `DocumentAssessmentController` + `InterviewController`: оценки членов Совета. */
@Injectable({ providedIn: 'root' })
export class AssessmentApi {
  private readonly http = inject(HttpClient);

  scoreDocuments(body: S['SectionScoreRequest']): Observable<S['SectionScoreResponse']> {
    return this.http.put<S['SectionScoreResponse']>(DOCUMENTS, body);
  }

  documentScores(applicationId: number): Observable<S['SectionScoreResponse'][]> {
    return this.http.get<S['SectionScoreResponse'][]>(DOCUMENTS, { params: toParams({ applicationId }) });
  }

  documentSummary(applicationId: number): Observable<S['AssessmentSummaryResponse']> {
    return this.http.get<S['AssessmentSummaryResponse']>(`${DOCUMENTS}/summary`, {
      params: toParams({ applicationId }),
    });
  }

  interviewCandidates(
    filter: { contestId?: number; meetingId?: number } & PageQuery,
  ): Observable<Page<S['InterviewCandidateResponse']>> {
    return this.http.get<Page<S['InterviewCandidateResponse']>>(INTERVIEWS, { params: toParams(filter) });
  }

  assessInterview(
    meetingId: number,
    applicationId: number,
    body: S['InterviewAssessmentRequest'],
  ): Observable<S['InterviewAssessmentResponse']> {
    return this.http.patch<S['InterviewAssessmentResponse']>(`${INTERVIEWS}/assessment`, body, {
      params: toParams({ meetingId, applicationId }),
    });
  }

  myInterviewAssessment(meetingId: number, applicationId: number): Observable<S['InterviewAssessmentResponse']> {
    return this.http.get<S['InterviewAssessmentResponse']>(`${INTERVIEWS}/my`, {
      params: toParams({ meetingId, applicationId }),
    });
  }
}
