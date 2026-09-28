import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import type { AssessmentSection, Schemas as S } from './api.types';

const API = environment.API;

type Holiday = S['HolidayResponse'];
type Question = S['AdditionalInfoQuestionResponse'];
type Reference = S['ReferenceDocumentResponse'];

/**
 * Настройки администратора: `DashboardController`, `HolidayController`, `ReferenceDocumentController`,
 * `ScheduleSettingsController`, `SectionWeightController`, `AdditionalInfoQuestionController`.
 */
@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly http = inject(HttpClient);

  dashboard(): Observable<S['MetricValue'][]> {
    return this.http.get<S['MetricValue'][]>(`${API}/dashboard`);
  }

  holidays(): Observable<Holiday[]> {
    return this.http.get<Holiday[]>(`${API}/holidays`);
  }

  createHoliday(body: S['HolidayRequest']): Observable<Holiday> {
    return this.http.post<Holiday>(`${API}/holidays`, body);
  }

  updateHoliday(id: number, body: S['HolidayRequest']): Observable<Holiday> {
    return this.http.put<Holiday>(`${API}/holidays/${id}`, body);
  }

  removeHoliday(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/holidays/${id}`);
  }

  references(): Observable<Reference[]> {
    return this.http.get<Reference[]>(`${API}/reference`);
  }

  /** Multipart: часть `document` — JSON, часть `file` — сам документ. */
  createReference(document: S['ReferenceDocumentRequest'], file: File): Observable<Reference> {
    return this.http.post<Reference>(`${API}/reference`, referenceForm(document, file));
  }

  updateReference(id: number, document: S['ReferenceDocumentRequest'], file?: File): Observable<Reference> {
    return this.http.put<Reference>(`${API}/reference/${id}`, referenceForm(document, file));
  }

  removeReference(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/reference/${id}`);
  }

  scheduleSettings(): Observable<S['ScheduleSettingsResponse']> {
    return this.http.get<S['ScheduleSettingsResponse']>(`${API}/schedule-settings`);
  }

  /** Только SUPER_ADMIN. */
  updateScheduleSettings(body: S['ScheduleSettingsRequest']): Observable<S['ScheduleSettingsResponse']> {
    return this.http.put<S['ScheduleSettingsResponse']>(`${API}/schedule-settings`, body);
  }

  weights(): Observable<S['SectionWeightResponse'][]> {
    return this.http.get<S['SectionWeightResponse'][]>(`${API}/weights`);
  }

  updateWeight(section: AssessmentSection, body: S['SectionWeightRequest']): Observable<S['SectionWeightResponse']> {
    return this.http.put<S['SectionWeightResponse']>(`${API}/weights/${section}`, body);
  }

  /** Активные вопросы доп. сведений — для кандидата. */
  additionalQuestions(): Observable<Question[]> {
    return this.http.get<Question[]>(`${API}/additional-info/questions`);
  }

  allAdditionalQuestions(): Observable<Question[]> {
    return this.http.get<Question[]>(`${API}/additional-info/questions/all`);
  }

  createAdditionalQuestion(body: S['AdditionalInfoQuestionRequest']): Observable<Question> {
    return this.http.post<Question>(`${API}/additional-info/questions`, body);
  }

  updateAdditionalQuestion(id: number, body: S['AdditionalInfoQuestionRequest']): Observable<Question> {
    return this.http.put<Question>(`${API}/additional-info/questions/${id}`, body);
  }
}

function referenceForm(document: S['ReferenceDocumentRequest'], file?: File): FormData {
  const form = new FormData();

  form.append('document', new Blob([JSON.stringify(document)], { type: 'application/json' }));

  if (file) form.append('file', file, file.name);

  return form;
}
