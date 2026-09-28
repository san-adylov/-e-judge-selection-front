import { inject, Injectable, InjectionToken } from '@angular/core';
import { defer, EMPTY, filter, map, Observable, share } from 'rxjs';

import { SessionService } from '../auth/session.service';
import { environment } from '../config/environment';
import { ERROR_CODES } from './api-error';

/** События `/v1/events`: только сигналы с id, без персональных данных — по сигналу стор перезапрашивает данные. */
export interface SseEventMap {
  connected: { channels: string[] };
  joinMeeting: { meetingId: number; participants: number; opened: boolean };
  meetingStatus: { meetingId: number; status: 'OPENED' | 'APPROVED' | 'DECLINED' };
  vote: { meetingId: number; subjectId: number };
  applicationStatus: { applicationId: number; status: string };
  notification: { notificationId: number; type: string };
  heartbeat: { ts: string };
  error: { code: string; errorCode: number };
}

export type SseEventName = keyof SseEventMap;

interface SseMessage {
  type: SseEventName;
  data: unknown;
}

const EVENT_NAMES: readonly SseEventName[] = [
  'connected',
  'joinMeeting',
  'meetingStatus',
  'vote',
  'applicationStatus',
  'notification',
  'heartbeat',
  'error',
];

export const SSE_RETRY_BASE_MS = 1_000;
export const SSE_RETRY_MAX_MS = 30_000;

export const EVENT_SOURCE_FACTORY = new InjectionToken<(url: string) => EventSource>('EVENT_SOURCE_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new EventSource(url),
});

/**
 * Одно SSE-соединение на вкладку: шлюз пускает не больше 3 потоков на пользователя и 10 подключений в минуту.
 * Соединение открывается с первой подпиской и закрывается с последней. Токен — в `?access_token=`,
 * потому что `EventSource` не умеет ставить заголовок (решение Р6). Переподключение — с растущей паузой.
 */
@Injectable({ providedIn: 'root' })
export class SseService {
  private readonly session = inject(SessionService);
  private readonly createSource = inject(EVENT_SOURCE_FACTORY);
  private readonly messages$ = defer(() => (this.session.token() ? this.stream() : EMPTY)).pipe(share());

  on<K extends SseEventName>(name: K): Observable<SseEventMap[K]> {
    return this.messages$.pipe(
      filter((message) => message.type === name),
      map((message) => message.data as SseEventMap[K]),
    );
  }

  private stream(): Observable<SseMessage> {
    return new Observable<SseMessage>((subscriber) => {
      let source: EventSource | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      let attempt = 0;
      let stopped = false;

      const close = () => {
        source?.close();
        source = null;
      };

      const reconnect = () => {
        close();

        if (stopped) return;

        const delay = Math.min(SSE_RETRY_MAX_MS, SSE_RETRY_BASE_MS * 2 ** attempt);

        attempt++;
        retryTimer = setTimeout(connect, delay);
      };

      const onEvent = (name: SseEventName, event: Event) => {
        // Нативное `error` (обрыв соединения) приходит без данных; серверное событие `error` — MessageEvent с JSON.
        if (name === 'error' && !(event instanceof MessageEvent && event.data)) {
          reconnect();

          return;
        }

        const data = parse((event as MessageEvent<string>).data);

        if (name === 'connected') attempt = 0;

        subscriber.next({ type: name, data });

        if (name === 'error' && (data as SseEventMap['error'] | null)?.errorCode === ERROR_CODES.SSE_MAX_CONNECTIONS) {
          stopped = true;
          close();
          subscriber.complete();
        }
      };

      const connect = () => {
        const token = this.session.token();

        if (!token) {
          subscriber.complete();

          return;
        }

        source = this.createSource(`${environment.API}/events?access_token=${encodeURIComponent(token)}`);
        EVENT_NAMES.forEach((name) => source?.addEventListener(name, (event) => onEvent(name, event)));
      };

      connect();

      return () => {
        stopped = true;
        clearTimeout(retryTimer);
        close();
      };
    });
  }
}

function parse(data: string | undefined): unknown {
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
