import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, type Observable, of, switchMap } from 'rxjs';

import type { ContestType, Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { skipErrorToast } from '@shared/api/http-context';

import { isActiveApplication, type OwnApplication, type Participation, participationOf } from './contest-action';
import { fetchAllPages } from './fetch-all';

export type ContestCard = Schemas['ContestCardResponse'];

export interface CandidateContests {
  /** `GET /contest/available`: все страницы, новые сверху; `null` — список загрузить не удалось. */
  cards: ContestCard[] | null;
  /** Заявки кандидата (`GET /contest-application/my`); `null` — загрузить не удалось. */
  participation: Participation | null;
}

/**
 * Конкурсы кандидата вместе с его заявками — общий источник для списка и карточки конкурса.
 * У `/contest/available` нет фильтра по типу, а правило «одна активная заявка на тип» (4102) требует типы
 * всех конкурсов с заявками, поэтому список загружается целиком (конкурсов единицы–десятки).
 * Источники независимы: ошибка одного не теряет другой, сам `load()` не завершается ошибкой.
 */
@Injectable({ providedIn: 'root' })
export class CandidateContestsLoader {
  private readonly contests = inject(ContestApi);
  private readonly applications = inject(ContestApplicationApi);

  load(): Observable<CandidateContests> {
    return forkJoin([
      fetchAllPages((query) => this.contests.available(query), { sort: 'id,desc' }).pipe(catchError(() => of(null))),
      fetchAllPages((query) => this.applications.my(query)).pipe(catchError(() => of(null))),
    ]).pipe(
      switchMap(([cards, applications]) => {
        if (!applications) return of({ cards, participation: null });

        const types = new Map<number, ContestType | null>();

        for (const card of cards ?? []) {
          if (card.id !== undefined) types.set(card.id, card.type ?? null);
        }

        return this.withMissingTypes(applications, types).pipe(
          map((known) => ({ cards, participation: participationOf(applications, known) })),
        );
      }),
    );
  }

  /**
   * Дополняет типы конкурсами активных заявок, которых нет в `/available` (например, отменённых — правило 4102
   * их учитывает): `GET /contest/{id}` открыт любому авторизованному. Тип не узнали — конкурса в результате нет,
   * и `participationOf` считает, что заявка блокирует все типы.
   */
  private withMissingTypes(
    applications: readonly OwnApplication[],
    types: ReadonlyMap<number, ContestType | null>,
  ): Observable<ReadonlyMap<number, ContestType | null>> {
    const missing = new Set<number>();

    for (const { contestId, status } of applications) {
      if (contestId !== undefined && isActiveApplication(status) && !types.has(contestId)) missing.add(contestId);
    }

    if (!missing.size) return of(types);

    return forkJoin(
      [...missing].map((id) =>
        this.contests.get(id, skipErrorToast()).pipe(
          map((contest) => [id, contest.type ?? null] as const),
          catchError(() => of(null)),
        ),
      ),
    ).pipe(
      map((entries) => {
        const known = new Map(types);

        for (const entry of entries) {
          if (entry) known.set(entry[0], entry[1]);
        }

        return known;
      }),
    );
  }
}
