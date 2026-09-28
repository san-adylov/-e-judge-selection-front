import { DOCUMENT } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { finalize, map, type Observable, shareReplay, timeout } from 'rxjs';

import { environment } from '../config/environment';

export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_DEFAULT_HEADER = 'X-XSRF-TOKEN';

interface CsrfTokenResponse {
  token: string;
  headerName: string;
}

/**
 * CSRF double-submit шлюза v2: `GET /v1/csrf` ставит cookie `XSRF-TOKEN`,
 * мутирующие запросы повторяют её значение в заголовке `X-XSRF-TOKEN`.
 */
@Injectable({ providedIn: 'root' })
export class CsrfService {
  private readonly document = inject(DOCUMENT);
  /** Мимо interceptors, чтобы запрос токена не зациклился на самом себе. */
  private readonly http = new HttpClient(inject(HttpBackend));
  private headerName = CSRF_DEFAULT_HEADER;
  /** Токен из тела ответа — на случай, если cookie шлюза недоступна скрипту (другой домен). */
  private lastToken: string | null = null;
  private inflight: Observable<string> | null = null;

  header(): string {
    return this.headerName;
  }

  token(): string | null {
    return readCookie(this.document.cookie, CSRF_COOKIE_NAME) ?? this.lastToken;
  }

  /** Запрашивает новый токен; параллельные вызовы делят один запрос. */
  sync(): Observable<string> {
    this.inflight ??= this.http.get<CsrfTokenResponse>(`${environment.API}/csrf`, { withCredentials: true }).pipe(
      timeout(10_000),
      map((response) => {
        this.headerName = response.headerName || CSRF_DEFAULT_HEADER;
        this.lastToken = response.token;

        return this.token() ?? response.token;
      }),
      finalize(() => (this.inflight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.inflight;
  }
}

export function readCookie(cookies: string, name: string): string | null {
  for (const part of cookies.split(';')) {
    const [key, ...rest] = part.trim().split('=');

    if (key === name) return decodeURIComponent(rest.join('='));
  }

  return null;
}
