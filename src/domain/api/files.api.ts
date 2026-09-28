import { HttpClient, type HttpContext, type HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import { type FileCategory, type Schemas as S, toParams } from './api.types';

const FILES = `${environment.API}/file`;

type FileRef = S['StoredFileRef'];

/**
 * `FileController`. В v2 `GET /file/{id}` — JSON-метаданные, сам файл — `GET /file/{id}/download`.
 * Лимиты: 50 МБ на файл, 64 МБ на запрос (413, коды 5005 / 4154).
 */
@Injectable({ providedIn: 'root' })
export class FilesApi {
  private readonly http = inject(HttpClient);

  upload(file: File, category: FileCategory, ownerUserId?: number): Observable<FileRef> {
    const body = new FormData();

    body.append('file', file, file.name);

    return this.http.post<FileRef>(`${FILES}/upload`, body, { params: toParams({ category, ownerUserId }) });
  }

  meta(id: number, context?: HttpContext): Observable<FileRef> {
    return this.http.get<FileRef>(`${FILES}/${id}`, { context });
  }

  download(id: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${FILES}/${id}/download`, { observe: 'response', responseType: 'blob' });
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${FILES}/${id}`);
  }
}
