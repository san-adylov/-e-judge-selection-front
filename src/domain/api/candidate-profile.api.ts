import { HttpClient, type HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import type { Schemas as S } from './api.types';

const BASE = `${environment.API}/candidate`;

type Profile = S['ProfileResponse'];

/** `CandidateProfileController` + `BanController`. Личные данные — JSON `ProfileRequest`, файлы — через `/v1/file/upload`. */
@Injectable({ providedIn: 'root' })
export class CandidateProfileApi {
  private readonly http = inject(HttpClient);

  /** 404 (4041), пока личные данные не заполнены: передайте `skipErrorToast()` и обработайте ответ сами. */
  my(context?: HttpContext): Observable<Profile> {
    return this.http.get<Profile>(`${BASE}/profile`, { context });
  }

  create(body: S['ProfileRequest']): Observable<Profile> {
    return this.http.post<Profile>(`${BASE}/profile`, body);
  }

  update(body: S['ProfileRequest']): Observable<Profile> {
    return this.http.put<Profile>(`${BASE}/profile`, body);
  }

  /** Владелец или сотрудник; 404 (4041), пока кандидат не заполнил личные данные. */
  ofUser(userId: number, context?: HttpContext): Observable<Profile> {
    return this.http.get<Profile>(`${BASE}/profile/${userId}`, { context });
  }

  full(userId: number): Observable<S['FullProfileResponse']> {
    return this.http.get<S['FullProfileResponse']>(`${BASE}/profile/${userId}/full`);
  }

  importDiplomas(): Observable<S['ImportResultResponse']> {
    return this.http.post<S['ImportResultResponse']>(`${BASE}/profile/education/import-diplomas`, null);
  }

  importCadastre(): Observable<S['ImportResultResponse']> {
    return this.http.post<S['ImportResultResponse']>(`${BASE}/profile/assets/import-cadastre`, null);
  }

  presentation(userId: number, body: S['PresentationRequest']): Observable<S['StoredFileRef']> {
    return this.http.post<S['StoredFileRef']>(`${BASE}/profile/${userId}/presentation`, body);
  }

  banStatus(context?: HttpContext): Observable<S['BanStatusResponse']> {
    return this.http.get<S['BanStatusResponse']>(`${BASE}/ban-status`, { context });
  }

  banStatusOf(userId: number, context?: HttpContext): Observable<S['BanStatusResponse']> {
    return this.http.get<S['BanStatusResponse']>(`${BASE}/${userId}/ban-status`, { context });
  }
}
