import { HttpClient, type HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const APPLICATIONS = `${environment.API}/judge-applications`;
const CONFIRMATIONS = `${environment.API}/active-judge-confirmations`;

type JudgeApplication = S['JudgeApplicationResponse'];
type Confirmation = S['JudgeConfirmationResponse'];

/**
 * `JudgeApplicationController` + `JudgeConfirmationController`.
 * Статус «на подтверждении» (в v1 — роль `JUDGE_PENDING_APPROVAL`) — `GET /active-judge-confirmations/my/latest`.
 */
@Injectable({ providedIn: 'root' })
export class JudgeApplicationsApi {
  private readonly http = inject(HttpClient);

  /** Создать или обновить свой черновик: одна заявка на пару (конкурс, судья), повторный вызов её обновляет. */
  create(body: S['JudgeApplicationDraftRequest']): Observable<JudgeApplication> {
    return this.http.post<JudgeApplication>(APPLICATIONS, body);
  }

  submit(id: number): Observable<JudgeApplication> {
    return this.http.post<JudgeApplication>(`${APPLICATIONS}/${id}/submit`, null);
  }

  my(): Observable<JudgeApplication[]> {
    return this.http.get<JudgeApplication[]>(`${APPLICATIONS}/my`);
  }

  /** Своя заявка по id. Отдельной точки для судьи нет (`GET /{id}` — только сотрудникам), поэтому ищем в `my()`. */
  myOne(id: number): Observable<JudgeApplication | undefined> {
    return this.my().pipe(map((applications) => applications.find((application) => application.id === id)));
  }

  myScores(id: number): Observable<S['JudgeScoresResponse']> {
    return this.http.get<S['JudgeScoresResponse']>(`${APPLICATIONS}/${id}/my/scores`);
  }

  register(id: number): Observable<JudgeApplication> {
    return this.http.put<JudgeApplication>(`${APPLICATIONS}/${id}/register`, null);
  }

  /** Тело — `JudgeRequests.Reporter`; в схеме имя `Reporter` занято другим DTO, поэтому тип описан здесь. */
  setReporter(id: number, boardMemberId: number): Observable<JudgeApplication> {
    return this.http.put<JudgeApplication>(`${APPLICATIONS}/${id}/reporter`, { boardMemberId });
  }

  setReady(id: number, ready: boolean): Observable<JudgeApplication> {
    return this.http.patch<JudgeApplication>(`${APPLICATIONS}/${id}/ready`, { ready } satisfies S['Ready']);
  }

  professionalScore(id: number, body: S['ProfessionalScore']): Observable<JudgeApplication> {
    return this.http.put<JudgeApplication>(`${APPLICATIONS}/${id}/professional-score`, body);
  }

  documentScore(id: number, body: S['DocumentScore']): Observable<unknown[]> {
    return this.http.put<unknown[]>(`${APPLICATIONS}/${id}/document-score`, body);
  }

  attachFile(id: number, fileId: number): Observable<JudgeApplication> {
    return this.http.post<JudgeApplication>(`${APPLICATIONS}/${id}/files`, { fileId } satisfies S['AttachFile']);
  }

  scheduleMeeting(id: number, body: S['ScheduleMeeting']): Observable<S['MeetingResponse']> {
    return this.http.post<S['MeetingResponse']>(`${APPLICATIONS}/${id}/meetings`, body);
  }

  inviteInterview(id: number, body: S['InterviewInvitation']): Observable<JudgeApplication> {
    return this.http.post<JudgeApplication>(`${APPLICATIONS}/${id}/invite-interview`, body);
  }

  get(id: number): Observable<JudgeApplication> {
    return this.http.get<JudgeApplication>(`${APPLICATIONS}/${id}`);
  }

  list(
    filter: { contestId?: number; status?: JudgeApplication['status'] } & PageQuery = {},
  ): Observable<Page<JudgeApplication>> {
    return this.http.get<Page<JudgeApplication>>(APPLICATIONS, { params: toParams(filter) });
  }

  underReview(query: PageQuery = {}): Observable<Page<JudgeApplication>> {
    return this.http.get<Page<JudgeApplication>>(`${APPLICATIONS}/under-review`, { params: toParams(query) });
  }

  activeForSecretary(query: PageQuery = {}): Observable<Page<JudgeApplication>> {
    return this.http.get<Page<JudgeApplication>>(`${APPLICATIONS}/active-for-secretary`, { params: toParams(query) });
  }

  createConfirmation(body: S['JudgeConfirmationRequest']): Observable<Confirmation> {
    return this.http.post<Confirmation>(CONFIRMATIONS, body);
  }

  submitConfirmation(id: number): Observable<Confirmation> {
    return this.http.post<Confirmation>(`${CONFIRMATIONS}/${id}/submit`, null);
  }

  /** 404, если подтверждений ещё не было: передайте `skipErrorToast()`. */
  myLatestConfirmation(context?: HttpContext): Observable<Confirmation> {
    return this.http.get<Confirmation>(`${CONFIRMATIONS}/my/latest`, { context });
  }

  myConfirmationHistory(): Observable<Confirmation[]> {
    return this.http.get<Confirmation[]>(`${CONFIRMATIONS}/my/history`);
  }

  confirmations(status?: Confirmation['status'], query: PageQuery = {}): Observable<Page<Confirmation>> {
    return this.http.get<Page<Confirmation>>(CONFIRMATIONS, { params: toParams({ status, ...query }) });
  }

  confirmation(id: number): Observable<Confirmation> {
    return this.http.get<Confirmation>(`${CONFIRMATIONS}/${id}`);
  }

  reviewConfirmation(id: number): Observable<Confirmation> {
    return this.http.post<Confirmation>(`${CONFIRMATIONS}/${id}/review`, null);
  }

  approveConfirmation(id: number): Observable<Confirmation> {
    return this.http.post<Confirmation>(`${CONFIRMATIONS}/${id}/approve`, null);
  }

  rejectConfirmation(id: number, reason: string): Observable<Confirmation> {
    return this.http.post<Confirmation>(`${CONFIRMATIONS}/${id}/reject`, { reason } satisfies S['Reject']);
  }
}
