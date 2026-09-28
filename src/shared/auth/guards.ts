import { inject } from '@angular/core';
import { type CanMatchFn, Router, type UrlSegment } from '@angular/router';

import type { AccessRule } from './access-groups';
import { FORBIDDEN_URL, homeUrl, signInUrlFor } from './areas';
import { SessionService } from './session.service';

/**
 * Доступ к маршруту по группам бэкенда: `canMatch: [access('BOARD')]`.
 * Не вошёл — на страницу входа своей зоны с `returnUrl`; нет группы — `/forbidden`.
 */
export function access(rule: AccessRule): CanMatchFn {
  return (_route, segments) => {
    const session = inject(SessionService);
    const router = inject(Router);

    if (!session.isAuthenticated()) {
      const url = targetUrl(router, segments);

      return router.createUrlTree([signInUrlFor(url)], { queryParams: { returnUrl: url } });
    }

    return session.can(rule) || router.createUrlTree([FORBIDDEN_URL]);
  };
}

/** Страницы входа: вошедшего пользователя отправляет в его зону. */
export const guestOnly: CanMatchFn = () => {
  const session = inject(SessionService);

  return !session.isAuthenticated() || inject(Router).parseUrl(homeUrl(session.session()));
};

/**
 * Вход на этап по коду: открыт и вошедшему в кабинет кандидату (код выдаёт секретарь, токен этапа заменит
 * текущую сессию). С уже полученным токеном этапа — сразу к упражнению.
 */
export const stageSignIn: CanMatchFn = () => {
  const session = inject(SessionService);

  return !session.stage() || inject(Router).parseUrl(homeUrl(session.session()));
};

/** Корневой редирект `''` → зона пользователя. */
export function redirectHome(): string {
  return homeUrl(inject(SessionService).session());
}

function targetUrl(router: Router, segments: UrlSegment[]): string {
  const navigation = router.currentNavigation();

  return navigation ? router.serializeUrl(navigation.extractedUrl) : '/' + segments.map((s) => s.path).join('/');
}
