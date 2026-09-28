import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { skipErrorToast } from '@shared/api/http-context';
import type { TokenResponse } from '@shared/auth/auth.models';
import { environment } from '@shared/config/environment';

import type { AuthSchemas as A } from './api.types';

const AUTH = environment.AUTH_API;

/**
 * `AuthController` + `EsiaController` (auth-service). Ошибки входа показывает сама страница, поэтому без тоста.
 * Выход (`POST /logout`, `GET /esia/logout-url`) — в `SessionService`.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(body: A['LoginRequest']): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${AUTH}/login`, body, { context: skipErrorToast() });
  }

  /** Код этапа: 6 символов `[A-Za-z0-9]`; ответ — токен этапа с `exerciseId` и `exerciseType` в claims. */
  otpLogin(code: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${AUTH}/otp-login`, { code } satisfies A['OtpLoginRequest'], {
      context: skipErrorToast(),
    });
  }

  register(body: A['RegistrationRequest']): Observable<A['UserResponse']> {
    return this.http.post<A['UserResponse']>(`${AUTH}/register`, body);
  }

  /** PKCE-вход через ЕСИА: `authorizationUrl` — куда уйти, `state` — сверить при возврате. */
  esiaStart(): Observable<Required<A['StartResponse']>> {
    return this.http.get<Required<A['StartResponse']>>(`${AUTH}/esia/start`);
  }

  esiaExchange(code: string, state: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${AUTH}/esia/exchange`, { code, state } satisfies A['ExchangeRequest'], {
      context: skipErrorToast(),
    });
  }
}
