import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LangService } from '@reforgium/presentia';

import { fakeTokenResponse } from '../../testing/tokens';
import { SessionService } from '../auth/session.service';
import { NotifyService } from '../ui/notify.service';
import { API_INTERCEPTORS } from './interceptors';

describe('API interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionService;
  let notify: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    notify = { error: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors(API_INTERCEPTORS)),
        provideHttpClientTesting(),
        { provide: NotifyService, useValue: notify },
        { provide: LangService, useValue: { get: (key: string) => key } },
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
  });

  afterEach(() => backend.verify());

  it('adds the bearer token to gateway requests only', () => {
    session.start(fakeTokenResponse(), 'password');

    http.get('/v1/contest/available').subscribe();
    http.get('/locales/shell.ru.json').subscribe();

    const gateway = backend.expectOne('/v1/contest/available');
    const asset = backend.expectOne('/locales/shell.ru.json');

    expect(gateway.request.headers.get('Authorization')).toBe(`Bearer ${session.token()}`);
    expect(asset.request.headers.has('Authorization')).toBe(false);
    gateway.flush({});
    asset.flush({});
  });

  it('uses the XSRF-TOKEN cookie for mutating requests', () => {
    document.cookie = 'XSRF-TOKEN=cookie-token; path=/';

    http.post('/v1/complaints', {}).subscribe();

    const request = backend.expectOne('/v1/complaints');

    expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('cookie-token');
    request.flush({});
  });

  it('fetches a CSRF token first when there is no cookie', () => {
    http.put('/v1/contest/1/stage-window/TESTING', {}).subscribe();

    backend.expectOne({ method: 'GET', url: '/v1/csrf' }).flush({ token: 'fresh', headerName: 'X-XSRF-TOKEN' });

    const request = backend.expectOne('/v1/contest/1/stage-window/TESTING');

    expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('fresh');
    request.flush({});
  });

  it('refreshes the CSRF token and retries once after a CSRF rejection', () => {
    document.cookie = 'XSRF-TOKEN=stale; path=/';

    let result: unknown;

    http.post('/v1/vote', {}).subscribe((body) => (result = body));

    backend
      .expectOne('/v1/vote')
      .flush({ reason: 'TOKEN_MISMATCH', traceId: 't-1' }, { status: 403, statusText: 'Forbidden' });
    document.cookie = 'XSRF-TOKEN=renewed; path=/';
    backend.expectOne('/v1/csrf').flush({ token: 'renewed', headerName: 'X-XSRF-TOKEN' });

    const retry = backend.expectOne('/v1/vote');

    expect(retry.request.headers.get('X-XSRF-TOKEN')).toBe('renewed');
    retry.flush({ id: 1 });
    expect(result).toEqual({ id: 1 });
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('ends the session on 401 from the gateway', () => {
    session.start(fakeTokenResponse(), 'password');

    const expire = vi.spyOn(session, 'expire');

    http.get('/v1/users/me').subscribe({ error: () => undefined });
    backend
      .expectOne('/v1/users/me')
      .flush({ errorCode: 4317, message: 'Сессия отозвана' }, { status: 401, statusText: 'Unauthorized' });

    expect(expire).toHaveBeenCalledOnce();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('treats 401 on sign-in as wrong credentials, not as an ended session', () => {
    session.start(fakeTokenResponse(), 'password');

    const expire = vi.spyOn(session, 'expire');

    http.post('/v1/auth/login', {}).subscribe({ error: () => undefined });
    backend.expectOne('/v1/csrf').flush({ token: 'x', headerName: 'X-XSRF-TOKEN' });
    backend
      .expectOne('/v1/auth/login')
      .flush({ errorCode: 4011, message: 'Неверный логин' }, { status: 401, statusText: 'Unauthorized' });

    expect(expire).not.toHaveBeenCalled();
  });

  it('shows the localized backend message with its error code', () => {
    http.get('/v1/contest/1').subscribe({ error: () => undefined });
    backend
      .expectOne('/v1/contest/1')
      .flush(
        { errorCode: 4040, message: 'Конкурс не найден', traceId: 'abc-123' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(notify.error).toHaveBeenCalledWith('Конкурс не найден', 'shell.errors.code: 4040 · abc-123');
  });
});
