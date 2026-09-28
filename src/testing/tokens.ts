import type { TokenResponse, UserSummary } from '@shared/auth/auth.models';

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Неподписанный JWT для тестов: фронт читает только payload. */
export function fakeJwt(claims: Record<string, unknown>): string {
  return [base64Url(JSON.stringify({ alg: 'RS256' })), base64Url(JSON.stringify(claims)), 'signature'].join('.');
}

export function fakeTokenResponse(
  user: Partial<UserSummary> = {},
  claims: Record<string, unknown> = {},
  expiresIn = 6 * 3600,
): TokenResponse {
  const summary: UserSummary = {
    id: 1,
    username: 'user',
    fullName: 'Асанов Асан Асанович',
    roles: ['CANDIDATE'],
    role: 'CANDIDATE',
    language: 'RU',
    ...user,
  };

  return {
    accessToken: fakeJwt({ sub: String(summary.id), roles: summary.roles, ...claims }),
    tokenType: 'Bearer',
    expiresIn,
    user: summary,
  };
}
