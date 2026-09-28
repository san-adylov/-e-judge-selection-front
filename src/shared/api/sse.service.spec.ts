import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { fakeTokenResponse } from '../../testing/tokens';
import { SessionService } from '../auth/session.service';
import { EVENT_SOURCE_FACTORY, SSE_RETRY_BASE_MS, SseService } from './sse.service';

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  closed = false;

  constructor(readonly url: string) {
    super();
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: unknown): void {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }

  fail(): void {
    this.dispatchEvent(new Event('error'));
  }
}

describe('SseService', () => {
  let sse: SseService;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    FakeEventSource.instances = [];

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: EVENT_SOURCE_FACTORY,
          useValue: (url: string) => new FakeEventSource(url) as unknown as EventSource,
        },
      ],
    });

    TestBed.inject(SessionService).start(fakeTokenResponse(), 'password');
    sse = TestBed.inject(SseService);
  });

  afterEach(() => vi.useRealTimers());

  it('opens one stream per tab with the token in the query', () => {
    const votes = sse.on('vote').subscribe();
    const notifications = sse.on('notification').subscribe();

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toMatch(/^\/v1\/events\?access_token=/);

    votes.unsubscribe();
    notifications.unsubscribe();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('delivers typed events by name', () => {
    const received: unknown[] = [];

    sse.on('meetingStatus').subscribe((event) => received.push(event));
    FakeEventSource.instances[0].emit('vote', { meetingId: 1, subjectId: 2 });
    FakeEventSource.instances[0].emit('meetingStatus', { meetingId: 1, status: 'OPENED' });

    expect(received).toEqual([{ meetingId: 1, status: 'OPENED' }]);
  });

  it('reconnects with a growing delay after a dropped connection', async () => {
    sse.on('notification').subscribe();

    FakeEventSource.instances[0].fail();
    expect(FakeEventSource.instances[0].closed).toBe(true);

    await vi.advanceTimersByTimeAsync(SSE_RETRY_BASE_MS);
    expect(FakeEventSource.instances).toHaveLength(2);

    FakeEventSource.instances[1].fail();
    await vi.advanceTimersByTimeAsync(SSE_RETRY_BASE_MS);
    expect(FakeEventSource.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(SSE_RETRY_BASE_MS);
    expect(FakeEventSource.instances).toHaveLength(3);
  });

  it('stops reconnecting when the gateway reports too many streams (4136)', async () => {
    let completed = false;

    sse.on('notification').subscribe({ complete: () => (completed = true) });
    FakeEventSource.instances[0].emit('error', { code: 'SSE_MAX_CONNECTIONS_REACHED', errorCode: 4136 });
    FakeEventSource.instances[0].fail();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(completed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
