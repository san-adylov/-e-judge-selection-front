import type { Page, Route } from '@playwright/test';

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

export function fakeJwt(claims: Record<string, unknown>): string {
  return [base64Url(JSON.stringify({ alg: 'RS256' })), base64Url(JSON.stringify(claims)), 'signature'].join('.');
}

export function tokenResponse(roles: string[], claims: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    accessToken: fakeJwt({ sub: '1', roles, ...claims }),
    tokenType: 'Bearer',
    expiresIn: 6 * 3600,
    user: { id: 1, username: 'secretary', fullName: 'Асанова Айгуль', roles, role: roles[0], language: 'RU' },
  };
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Минимальный шлюз v2: CSRF, SSE-заглушка и счётчик уведомлений; остальное задаёт тест. */
export async function mockGateway(page: Page): Promise<void> {
  await page.route('**/v1/**', (route) => json(route, { errorCode: 4040, message: 'Не найдено' }, 404));
  await page.route('**/v1/csrf', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Set-Cookie': 'XSRF-TOKEN=e2e-token; Path=/; SameSite=Lax' },
      body: JSON.stringify({ token: 'e2e-token', headerName: 'X-XSRF-TOKEN' }),
    }),
  );
  await page.route('**/v1/events**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: connected\ndata: {"channels":[]}\n\n' }),
  );
  await page.route('**/v1/notifications/unread-count', (route) => json(route, { unread: 3 }));
}

export { json };
