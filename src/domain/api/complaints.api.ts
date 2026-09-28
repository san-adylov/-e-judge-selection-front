import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const COMPLAINTS = `${environment.API}/complaints`;
const REVIEWS = `${environment.API}/complaint-reviews`;

type Complaint = S['ComplaintResponse'];

export interface ComplaintFilter extends PageQuery {
  type?: Complaint['type'];
  status?: Complaint['status'];
  contestId?: number;
}

/** `ComplaintController` + `ComplaintReviewController`. Голоса по жалобам — общий `POST /v1/vote`. */
@Injectable({ providedIn: 'root' })
export class ComplaintsApi {
  private readonly http = inject(HttpClient);

  submit(body: S['SubmitComplaintRequest']): Observable<Complaint> {
    return this.http.post<Complaint>(COMPLAINTS, body);
  }

  get(id: number): Observable<Complaint> {
    return this.http.get<Complaint>(`${COMPLAINTS}/${id}`);
  }

  my(query: PageQuery = {}): Observable<Page<Complaint>> {
    return this.http.get<Page<Complaint>>(`${COMPLAINTS}/my`, { params: toParams(query) });
  }

  list(filter: ComplaintFilter = {}): Observable<Page<Complaint>> {
    return this.http.get<Page<Complaint>>(COMPLAINTS, { params: toParams(filter) });
  }

  testReviewDocument(id: number): Observable<S['StoredFileRef']> {
    return this.http.post<S['StoredFileRef']>(`${COMPLAINTS}/${id}/test-review-document`, null);
  }

  conclusion(id: number): Observable<S['StoredFileRef']> {
    return this.http.post<S['StoredFileRef']>(`${COMPLAINTS}/${id}/conclusion`, null);
  }

  attachToMeeting(body: S['AttachComplaintRequest']): Observable<Complaint> {
    return this.http.post<Complaint>(REVIEWS, body);
  }

  closeReview(meetingId: number): Observable<S['MeetingResponse']> {
    return this.http.post<S['MeetingResponse']>(`${REVIEWS}/${meetingId}/close`, null);
  }

  /** Материалы заседания; голоса — в `items[].votes`. */
  reviewMaterials(meetingId: number): Observable<S['ComplaintReviewMaterialsResponse']> {
    return this.http.get<S['ComplaintReviewMaterialsResponse']>(`${REVIEWS}/${meetingId}`);
  }
}
