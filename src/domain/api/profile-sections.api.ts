import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type ProfileSection, type Schemas as S, toParams } from './api.types';

const BASE = `${environment.API}/candidate/sections`;

/** Тела запросов и ответов по разделам личного дела. Ответ всегда несёт `id` и `ownerId`. */
export interface SectionContracts {
  EDUCATION: { request: S['EducationRequest']; response: S['EducationResponse'] };
  ACADEMIC_DEGREE: { request: S['AcademicDegreeRequest']; response: S['AcademicDegreeResponse'] };
  CERTIFICATE: { request: S['CertificateRequest']; response: S['CertificateResponse'] };
  EMPLOYMENT: { request: S['EmploymentRequest']; response: S['EmploymentResponse'] };
  AWARD: { request: S['AwardRequest']; response: S['AwardResponse'] };
  RELATIVE: { request: S['RelativeRequest']; response: S['RelativeResponse'] };
  ASSET: { request: S['AssetRequest']; response: S['AssetResponse'] };
  ADDITIONAL_INFO: { request: S['AdditionalInfoAnswerRequest']; response: S['AdditionalInfoAnswerResponse'] };
  DOCUMENT: { request: S['DocumentRequest']; response: S['DocumentResponse'] };
}

export type SectionRequest<K extends ProfileSection> = SectionContracts[K]['request'];
export type SectionRecord<K extends ProfileSection> = SectionContracts[K]['response'];

/** `ProfileSectionController`: один CRUD на 9 разделов вместо 35 эндпоинтов v1. */
@Injectable({ providedIn: 'root' })
export class ProfileSectionsApi {
  private readonly http = inject(HttpClient);

  /** `userId` — только для сотрудников; без него — свои записи. */
  list<K extends ProfileSection>(section: K, userId?: number): Observable<SectionRecord<K>[]> {
    return this.http.get<SectionRecord<K>[]>(`${BASE}/${section}`, { params: toParams({ userId }) });
  }

  get<K extends ProfileSection>(section: K, id: number): Observable<SectionRecord<K>> {
    return this.http.get<SectionRecord<K>>(`${BASE}/${section}/${id}`);
  }

  create<K extends ProfileSection>(section: K, body: SectionRequest<K>): Observable<SectionRecord<K>> {
    return this.http.post<SectionRecord<K>>(`${BASE}/${section}`, body);
  }

  update<K extends ProfileSection>(section: K, id: number, body: SectionRequest<K>): Observable<SectionRecord<K>> {
    return this.http.put<SectionRecord<K>>(`${BASE}/${section}/${id}`, body);
  }

  /** Логическое удаление, 204. */
  remove(section: ProfileSection, id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/${section}/${id}`);
  }
}
