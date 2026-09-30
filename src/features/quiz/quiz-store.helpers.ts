import { HttpErrorResponse } from '@angular/common/http';
import { type MonoTypeOperatorFunction, retry, throwError, timer } from 'rxjs';

/** Повторы при обрыве связи и 5xx: 1 с, затем 2 с. Повтор ответа безопасен — дубль вернёт 4116. */
const TRANSIENT_RETRIES = 2;

/** Копия множества или словаря без ключа `number` (для неизменяемых сигналов). */
export function without<T extends ReadonlySet<number> | ReadonlyMap<number, unknown>>(source: T, number: number): T {
  const copy = source instanceof Map ? new Map(source) : new Set(source as ReadonlySet<number>);

  copy.delete(number);

  return copy as unknown as T;
}

/** Обрыв связи или сбой сервера — есть смысл повторить; бизнес-ошибки (4xx) не повторяются. */
export function isTransient(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}

export function retryTransient<T>(): MonoTypeOperatorFunction<T> {
  return retry<T>({
    count: TRANSIENT_RETRIES,
    delay: (error: unknown, attempt: number) => (isTransient(error) ? timer(attempt * 1000) : throwError(() => error)),
  });
}
