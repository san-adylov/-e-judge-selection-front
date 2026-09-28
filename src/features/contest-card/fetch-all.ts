import { EMPTY, expand, map, type Observable, reduce } from 'rxjs';

import type { Page, PageQuery } from '@domain/api/api.types';

/**
 * Все страницы списка подряд — для коротких списков кандидата (конкурсы, свои заявки),
 * где нужен фильтр или поиск, которых нет у эндпоинта.
 */
export function fetchAllPages<T>(
  load: (query: PageQuery) => Observable<Page<T>>,
  query: Omit<PageQuery, 'page'> = {},
  size = 100,
): Observable<T[]> {
  return load({ ...query, page: 0, size }).pipe(
    expand((page) =>
      page.last || page.page + 1 >= page.totalPages ? EMPTY : load({ ...query, page: page.page + 1, size }),
    ),
    map((page) => page.content ?? []),
    reduce((all, items) => all.concat(items), [] as T[]),
  );
}
