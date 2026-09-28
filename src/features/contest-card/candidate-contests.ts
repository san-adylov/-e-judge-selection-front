import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, type Observable, of } from 'rxjs';

import type { ContestType, Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';

import { type Participation, participationOf } from './contest-action';
import { fetchAllPages } from './fetch-all';

export type ContestCard = Schemas['ContestCardResponse'];

export interface CandidateContests {
  /** `GET /contest/available`: все страницы, новые сверху. */
  cards: ContestCard[];
  participation: Participation;
}

/**
 * Конкурсы кандидата вместе с его заявками — общий источник для списка и карточки конкурса.
 * У `/contest/available` нет фильтра по типу, а правило «одна активная заявка на тип» (4102) требует типы
 * всех конкурсов с заявками, поэтому список загружается целиком (конкурсов единицы–десятки).
 */
@Injectable({ providedIn: 'root' })
export class CandidateContestsLoader {
  private readonly contests = inject(ContestApi);
  private readonly applications = inject(ContestApplicationApi);

  load(): Observable<CandidateContests> {
    return forkJoin([
      fetchAllPages((query) => this.contests.available(query), { sort: 'id,desc' }),
      // Без заявок список остаётся рабочим: «Моя заявка» ведёт в общий список, 4102 проверит бэкенд.
      fetchAllPages((query) => this.applications.my(query)).pipe(
        catchError(() => of<Schemas['ApplicationResponse'][]>([])),
      ),
    ]).pipe(
      map(([cards, applications]) => {
        const types = new Map<number, ContestType | null>();

        for (const card of cards) {
          if (card.id !== undefined) types.set(card.id, card.type ?? null);
        }

        return { cards, participation: participationOf(applications, types) };
      }),
    );
  }
}
