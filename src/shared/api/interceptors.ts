import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { LangService } from '@reforgium/presentia';
import { catchError, of, switchMap, throwError } from 'rxjs';

import { SessionService } from '../auth/session.service';
import { environment } from '../config/environment';
import { NotifyService } from '../ui/notify.service';
import { apiErrorOf, isCsrfRejection } from './api-error';
import { CsrfService } from './csrf.service';
import { SKIP_ERROR_TOAST } from './http-context';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);
/** Публичные маршруты входа: 401 здесь — неверные данные, а не конец сессии. */
const PUBLIC_AUTH_PATHS = ['/login', '/register', '/otp-login', '/esia/'].map((path) => environment.AUTH_API + path);

export function isGatewayRequest(req: HttpRequest<unknown>): boolean {
  return req.url.startsWith(`${environment.API}/`);
}

function isPublicAuthRequest(req: HttpRequest<unknown>): boolean {
  return PUBLIC_AUTH_PATHS.some((path) => req.url.startsWith(path));
}

/** `Authorization: Bearer <accessToken>` для запросов к шлюзу. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionService).token();

  if (!token || !isGatewayRequest(req) || req.headers.has('Authorization')) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/**
 * CSRF double-submit для POST/PUT/PATCH/DELETE: токен из cookie `XSRF-TOKEN` (или `GET /v1/csrf`,
 * если cookie нет) в заголовке `X-XSRF-TOKEN`. Отказ CSRF (403 с `reason`) — новый токен и один повтор.
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (SAFE_METHODS.has(req.method) || !isGatewayRequest(req)) return next(req);

  const csrf = inject(CsrfService);
  const withToken = (token: string) => req.clone({ setHeaders: { [csrf.header()]: token }, withCredentials: true });
  const current = csrf.token();
  const token$ = current ? of(current) : csrf.sync();

  return token$.pipe(
    switchMap((token) => next(withToken(token))),
    catchError((error: unknown) =>
      isCsrfRejection(error) ? csrf.sync().pipe(switchMap((token) => next(withToken(token)))) : throwError(() => error),
    ),
  );
};

/**
 * 401 от шлюза → конец сессии и вход (refresh-токена в v2 нет). Остальные ошибки → тост с
 * локализованным сообщением бэкенда и кодом ошибки. Ошибка пробрасывается дальше без изменений.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const notify = inject(NotifyService);
  const lang = inject(LangService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      if (error.status === 401 && isGatewayRequest(req) && !isPublicAuthRequest(req) && session.isAuthenticated()) {
        notify.warn(lang.get('shell.errors.session-ended'));
        session.expire();

        return throwError(() => error);
      }

      if (!req.context.get(SKIP_ERROR_TOAST)) {
        const body = apiErrorOf(error);

        if (body) {
          const detail = [`${lang.get('shell.errors.code')}: ${body.errorCode}`, body.traceId].filter(Boolean);

          notify.error(body.message, detail.join(' · '));
        } else if (isCsrfRejection(error)) notify.error(lang.get('shell.errors.csrf'));
        else if (error.status === 0) notify.error(lang.get('shell.errors.network'));
        else notify.error(lang.get('shell.errors.generic'), `HTTP ${error.status}`);
      }

      return throwError(() => error);
    }),
  );
};

/** Порядок важен: ошибки видят результат после CSRF-повтора; авторизация — ближе всего к сети. */
export const API_INTERCEPTORS = [errorInterceptor, csrfInterceptor, authInterceptor];
