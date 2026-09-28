import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type Page, type PageQuery, type Schemas as S, toParams } from './api.types';

const VACANCIES = `${environment.API}/vacancy`;
const APPLICATIONS = `${environment.API}/vacancy-application`;

type Vacancy = S['VacancyResponse'];
type VacancyApplication = S['VacancyApplicationResponse'];

/** `VacancyController` + `VacancyApplicationController`. Создание и отмена — председатель, публикация — секретарь. */
@Injectable({ providedIn: 'root' })
export class VacanciesApi {
  private readonly http = inject(HttpClient);

  create(body: S['VacancyRequest']): Observable<Vacancy> {
    return this.http.post<Vacancy>(VACANCIES, body);
  }

  update(id: number, body: S['VacancyRequest']): Observable<Vacancy> {
    return this.http.patch<Vacancy>(`${VACANCIES}/${id}`, body);
  }

  publish(id: number): Observable<Vacancy> {
    return this.http.post<Vacancy>(`${VACANCIES}/${id}/publish`, null);
  }

  cancel(id: number): Observable<Vacancy> {
    return this.http.post<Vacancy>(`${VACANCIES}/${id}/cancel`, null);
  }

  /** Возвращает id созданного заседания. */
  scheduleMeeting(id: number, body: S['ScheduleVacancyMeetingRequest']): Observable<number> {
    return this.http.post<number>(`${VACANCIES}/${id}/meeting`, body);
  }

  selectFromReserve(id: number): Observable<S['Selection']> {
    return this.http.post<S['Selection']>(`${VACANCIES}/${id}/select-from-reserve`, null);
  }

  get(id: number): Observable<Vacancy> {
    return this.http.get<Vacancy>(`${VACANCIES}/${id}`);
  }

  list(status?: Vacancy['status'], query: PageQuery = {}): Observable<Page<Vacancy>> {
    return this.http.get<Page<Vacancy>>(VACANCIES, { params: toParams({ status, ...query }) });
  }

  byContest(contestId: number, query: PageQuery = {}): Observable<Page<Vacancy>> {
    return this.http.get<Page<Vacancy>>(`${VACANCIES}/by-contest/${contestId}`, { params: toParams(query) });
  }

  available(query: PageQuery = {}): Observable<Page<Vacancy>> {
    return this.http.get<Page<Vacancy>>(`${VACANCIES}/available`, { params: toParams(query) });
  }

  apply(body: S['ApplyToVacancyRequest']): Observable<VacancyApplication> {
    return this.http.post<VacancyApplication>(APPLICATIONS, body);
  }

  withdrawApplication(id: number): Observable<VacancyApplication> {
    return this.http.post<VacancyApplication>(`${APPLICATIONS}/${id}/withdraw`, null);
  }

  confirmApplication(id: number): Observable<VacancyApplication> {
    return this.http.post<VacancyApplication>(`${APPLICATIONS}/${id}/confirm`, null);
  }

  generateSunush(applicationId: number): Observable<VacancyApplication> {
    return this.http.post<VacancyApplication>(`${APPLICATIONS}/${applicationId}/sunush`, null);
  }

  confirmSunush(applicationId: number): Observable<VacancyApplication> {
    return this.http.post<VacancyApplication>(`${APPLICATIONS}/${applicationId}/sunush/confirm`, null);
  }

  myApplications(): Observable<VacancyApplication[]> {
    return this.http.get<VacancyApplication[]>(`${APPLICATIONS}/my`);
  }

  applicationsByVacancy(vacancyId: number): Observable<VacancyApplication[]> {
    return this.http.get<VacancyApplication[]>(`${APPLICATIONS}/by-vacancy/${vacancyId}`);
  }
}
