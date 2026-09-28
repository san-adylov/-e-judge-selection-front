import { expect, test } from '@playwright/test';

import { json, mockGateway, tokenResponse } from './gateway-mock';

test.describe('вход и доступ', () => {
  test.beforeEach(async ({ page }) => mockGateway(page));

  test('аноним с корня попадает на вход кандидата через ЕСИ', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/cabinet\/sign-in/);
    await expect(page.getByRole('button', { name: 'Войти через ЕСИ' })).toBeVisible();
  });

  test('закрытый экран администрирования ведёт на вход сотрудника с returnUrl', async ({ page }) => {
    await page.goto('/administrative/meetings');

    await expect(page).toHaveURL(/\/administrative\/sign-in\?returnUrl=%2Fadministrative%2Fmeetings/);
  });

  test('вход по коду этапа принимает только 6 символов', async ({ page }) => {
    await page.goto('/testing/sign-in');

    await expect(page.getByRole('button', { name: 'Войти' })).toBeDisabled();
  });

  test('секретарь входит по паролю и видит только свои пункты меню', async ({ page }) => {
    let csrfHeader: string | null = null;

    await page.route('**/v1/auth/login', async (route) => {
      csrfHeader = route.request().headers()['x-xsrf-token'] ?? null;
      await json(route, tokenResponse(['SECRETARY']));
    });
    await page.route('**/v1/dashboard', (route) =>
      json(route, [
        { type: 'OPEN_CONTESTS', value: 2 },
        { type: 'APPLICATIONS', value: 17 },
      ]),
    );

    await page.goto('/administrative/sign-in');
    await page.getByLabel('Логин').fill('secretary');
    await page.locator('#password').fill('secret-password');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page).toHaveURL(/\/administrative\/dashboard/);
    await expect(page.getByText('17')).toBeVisible();
    expect(csrfHeader).toBe('e2e-token');

    // Секретарь — COUNCIL, но не BOARD и не ADMIN.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole('link', { name: 'Заявки' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Проверка эссе' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Журнал аудита' })).toHaveCount(0);
  });

  test('кандидат без ролей Совета получает «Нет доступа» в администрировании', async ({ page }) => {
    await page.route('**/v1/auth/esia/start', (route) =>
      json(route, { authorizationUrl: '/cabinet/sign-in?code=esia-code&state=s-1', state: 's-1' }),
    );
    await page.route('**/v1/auth/esia/exchange', (route) => json(route, tokenResponse(['CANDIDATE'])));
    await page.route('**/v1/candidate/sections/**', (route) => json(route, []));

    await page.goto('/cabinet/sign-in');
    await page.getByRole('button', { name: 'Войти через ЕСИ' }).click();
    await expect(page).toHaveURL(/\/cabinet\/profile/);

    await page.goto('/administrative/dashboard');
    await expect(page).toHaveURL(/\/forbidden/);
    await expect(page.getByRole('heading', { name: 'Нет доступа' })).toBeVisible();
  });
});

/** Сценарии-гейты релиза (раздел 7 документации) — выполняются только на тестовом стенде бэкенда v2. */
test.describe('сценарии на стенде @stand', () => {
  test.fixme('подача заявки на конкурс', async () => undefined);
  test.fixme('голосование на заседании с подписью ОЭП', async () => undefined);
  test.fixme('тест и эссе по коду этапа', async () => undefined);
  test.fixme('вход через ЕСИА', async () => undefined);
  test.fixme('подача жалобы', async () => undefined);
});
