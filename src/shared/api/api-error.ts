import { HttpErrorResponse } from '@angular/common/http';

/** Тело ошибки бэкенда v2 (`common/error/ErrorResponse.java`, Приложение Б спеки). */
export interface ApiError {
  errorCode: number;
  /** Уже локализовано по claim `lang` токена (RU для анонимных запросов). */
  message: string;
  /** Только при ошибке валидации 4001: поле → сообщение. */
  fields?: Record<string, string>;
  traceId?: string;
}

/** Отказ CSRF-фильтра шлюза: HTTP 403 без `errorCode`. */
export interface CsrfRejection {
  reason: 'COOKIE_MISSING' | 'HEADER_MISSING' | 'TOKEN_MISMATCH';
  traceId?: string;
}

export const ERROR_CODES = {
  VALIDATION: 4001,
  FORBIDDEN: 4031,
  NOT_FOUND: 4040,
  SSE_MAX_CONNECTIONS: 4136,
  RATE_LIMITED: 4301,
  OUTSIDE_WORKING_HOURS: 4302,
  ACCOUNT_INACTIVE: 4303,
  SESSION_REVOKED: 4317,
  SERVICE_UNAVAILABLE: 5000,
} as const;

const CSRF_REASONS: ReadonlySet<string> = new Set(['COOKIE_MISSING', 'HEADER_MISSING', 'TOKEN_MISMATCH']);

export function isApiError(body: unknown): body is ApiError {
  return (
    body !== null &&
    typeof body === 'object' &&
    typeof (body as ApiError).errorCode === 'number' &&
    typeof (body as ApiError).message === 'string'
  );
}

export function isCsrfRejection(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) return false;

  const reason = (error.error as Partial<CsrfRejection> | null)?.reason;

  return typeof reason === 'string' && CSRF_REASONS.has(reason);
}

/** Тело ошибки бэкенда из ответа, если оно есть. */
export function apiErrorOf(error: unknown): ApiError | null {
  if (error instanceof HttpErrorResponse) return isApiError(error.error) ? error.error : null;

  return isApiError(error) ? error : null;
}
