import type { Route } from '@angular/router';

import type { AccessRule } from '@shared/auth/access-groups';
import { access } from '@shared/auth/guards';

export interface ScreenSpec {
  path: string;
  /** Ключ i18n заголовка (`TitleStrategy` переводит его). */
  title: string;
  /** Кто видит экран — та же группа, что на бэкенде. */
  access: AccessRule;
  /** Кто выполняет действия, если это не вся группа. */
  actions?: string;
  /** Маршруты API v2 от префикса `/v1` — чек-лист переноса экрана. */
  api: string[];
}

/**
 * Экран карты маршрутов, ещё не перенесённый из v1: доступ уже как в v2, вместо контента — заглушка
 * со списком API. При переносе `loadComponent` меняется на страницу, остальное остаётся.
 */
export function screen(spec: ScreenSpec): Route {
  return {
    path: spec.path,
    title: spec.title,
    canMatch: [access(spec.access)],
    loadComponent: () => import('@shared/ui/page/page-placeholder.component').then((m) => m.PagePlaceholderComponent),
    data: {
      access: typeof spec.access === 'string' ? spec.access : spec.access.join(', '),
      actions: spec.actions ?? '',
      api: spec.api,
    },
  };
}
