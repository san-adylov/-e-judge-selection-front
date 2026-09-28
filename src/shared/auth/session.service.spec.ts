import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { fakeTokenResponse } from '../../testing/tokens';
import { SessionService } from './session.service';

describe('SessionService', () => {
  function setup(): { session: SessionService; router: Router; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    return {
      session: TestBed.inject(SessionService),
      router: TestBed.inject(Router),
      http: TestBed.inject(HttpTestingController),
    };
  }

  beforeEach(() => localStorage.clear());

  afterEach(() => vi.useRealTimers());

  it('removes v1 session keys on start-up', () => {
    localStorage.setItem('token', 'v1-token');
    localStorage.setItem('user', '{}');
    localStorage.setItem('exerciseIds', '[1]');

    setup();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('exerciseIds')).toBeNull();
  });

  it('keeps the session in storage and restores it', () => {
    const { session } = setup();

    session.start(fakeTokenResponse({ roles: ['SECRETARY'] }), 'password');

    expect(session.isAuthenticated()).toBe(true);
    expect(session.can('COUNCIL')).toBe(true);
    expect(session.can('CANDIDATE')).toBe(false);

    TestBed.resetTestingModule();

    const restored = setup().session;

    expect(restored.user()?.roles).toEqual(['SECRETARY']);
  });

  it('reads the stage exercise from a stage token', () => {
    const { session } = setup();

    session.start(fakeTokenResponse({}, { exerciseId: 5, exerciseType: 'ESSAY' }), 'stage-code');

    expect(session.stage()).toEqual({ exerciseId: 5, exerciseType: 'ESSAY' });
  });

  it('warns before expiry and signs out when expiresIn runs out', async () => {
    vi.useFakeTimers();

    const { session, router } = setup();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    session.start(fakeTokenResponse({}, {}, 10 * 60), 'password');

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    expect(session.expiringSoon()).toBe(false);

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(session.expiringSoon()).toBe(true);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(session.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/cabinet/sign-in'], expect.anything());
  });

  it('revokes the session on the server when logging out', async () => {
    const { session, router, http } = setup();
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    session.start(fakeTokenResponse(), 'password');

    const done = session.logout();

    await Promise.resolve();
    http.expectOne({ method: 'POST', url: '/v1/auth/logout' }).flush(null, { status: 204, statusText: 'No Content' });
    await done;

    expect(session.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ejs2.session')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/cabinet/sign-in');
  });
});
