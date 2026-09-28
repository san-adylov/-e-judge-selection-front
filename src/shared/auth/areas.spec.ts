import type { Role } from './access-groups';
import { homeUrl, safeReturnUrl, signInUrlFor } from './areas';
import type { Session, StageExercise } from './auth.models';

function session(roles: Role[], stage: StageExercise | null = null): Session {
  return {
    accessToken: 't',
    expiresAt: Date.now() + 60_000,
    method: 'password',
    stage,
    user: { id: 1, username: 'u', fullName: 'U', roles, role: roles[0] ?? null, language: 'RU' },
  };
}

describe('areas', () => {
  it('sends anonymous users to the cabinet sign-in', () => {
    expect(homeUrl(null)).toBe('/cabinet/sign-in');
  });

  it('prefers the administrative area when the user has STAFF', () => {
    expect(homeUrl(session(['CANDIDATE', 'BOARD_MEMBER']))).toBe('/administrative');
    expect(homeUrl(session(['ACTIVE_JUDGE']))).toBe('/cabinet');
  });

  it('routes a stage token to its exercise', () => {
    expect(homeUrl(session(['CANDIDATE'], { exerciseId: 42, exerciseType: 'TEST' }))).toBe('/testing/quiz/42');
    expect(homeUrl(session(['CANDIDATE'], { exerciseId: 7, exerciseType: 'ESSAY' }))).toBe('/testing/essay');
  });

  it('picks the sign-in page of the current area', () => {
    expect(signInUrlFor('/administrative/meetings/1')).toBe('/administrative/sign-in');
    expect(signInUrlFor('/testing/quiz/1')).toBe('/testing/sign-in');
    expect(signInUrlFor('/cabinet/profile')).toBe('/cabinet/sign-in');
  });

  it('accepts only internal return urls', () => {
    expect(safeReturnUrl('/administrative/meetings/5?tab=votes')).toBe('/administrative/meetings/5?tab=votes');
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('/\\evil.example')).toBeNull();
    expect(safeReturnUrl('/cabinet/sign-in')).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });
});
