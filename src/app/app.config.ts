import { provideHttpClient, withInterceptors, withNoXsrfProtection } from '@angular/common/http';
import {
  type ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideDataGridDefaults } from '@reforgium/data-grid';
import { provideReInit } from '@reforgium/presentia';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { API_INTERCEPTORS } from '@shared/api/interceptors';

import { routes } from './app.routes';
import { AppPreset } from './app.theme';
import { AppTitleStrategy } from './app.title-strategy';

/** Брейкпоинты v1 — те же значения, что `--breakpoint-*` в `styles.css`. */
export const BREAKPOINTS = {
  'mobile': '(max-width: 719px)',
  'tablet': '(min-width: 720px) and (max-width: 1399px)',
  'desktop-s': '(min-width: 1400px) and (max-width: 1919px)',
  'desktop': '(min-width: 1920px)',
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    // Встроенный XSRF Angular выключен: CSRF шлюза v2 (с запросом токена и повтором) — в csrfInterceptor.
    provideHttpClient(withInterceptors(API_INTERCEPTORS), withNoXsrfProtection()),
    providePrimeNG({
      ripple: false,
      theme: {
        preset: AppPreset,
        options: { darkModeSelector: '.app-dark', cssLayer: { name: 'primeng', order: 'theme, base, primeng' } },
      },
    }),
    provideReInit({
      locale: {
        url: '/locales',
        isFromAssets: true,
        defaultLang: 'ru',
        fallbackLang: 'ru',
        kgValue: 'kg',
        supportedLangs: ['ru', 'kg'],
        preloadNamespaces: ['shell'],
      },
      langPipe: { placeholder: '…' },
      breakpoints: BREAKPOINTS,
    }),
    provideDataGridDefaults({ pageSize: 20, rowHeight: 56 }),
    MessageService,
    ConfirmationService,
    { provide: LOCALE_ID, useValue: 'ru' },
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
