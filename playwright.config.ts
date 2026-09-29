import { defineConfig, devices } from '@playwright/test';

/**
 * E2E. Локально поднимает `ng serve`; в CI — `E2E_BASE_URL` тестового стенда бэкенда v2.
 * Смоук-тесты и сценарии с моками шлюза (`page.route`) идут без стенда; сценарии `@stand` — только на стенде.
 */
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4000';
const onStand = Boolean(process.env['E2E_BASE_URL']);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['junit', { outputFile: 'test-results/junit.xml' }], ['html', { open: 'never' }]] : 'list',
  grepInvert: onStand ? undefined : /@stand/,
  // Первый заход в ленивый маршрут на холодном dev-сервере бывает дольше 5 с.
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Мастер заявки обязан работать от 360 px — одна адаптивная версия вместо mobile-копий.
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } } },
  ],
  webServer: onStand
    ? undefined
    : { command: 'npm start', url: baseURL, reuseExistingServer: !process.env['CI'], timeout: 180_000 },
});
