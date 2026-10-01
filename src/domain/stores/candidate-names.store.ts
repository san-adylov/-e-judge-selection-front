import { computed, inject, Injectable, type Signal, signal } from '@angular/core';

import { CandidateProfileApi } from '../api/candidate-profile.api';

/**
 * ФИО кандидатов по `userId` с кешем на вкладку: в `ApplicationResponse` имени нет, его отдаёт
 * `GET /candidate/profile/{userId}` (владелец или сотрудник). Один запрос на пользователя, пустая строка —
 * профиль не заполнен или недоступен.
 */
@Injectable({ providedIn: 'root' })
export class CandidateNamesStore {
  private readonly api = inject(CandidateProfileApi);
  private readonly names = signal<ReadonlyMap<number, string>>(new Map());
  private readonly requested = new Set<number>();

  /** `null` — ещё загружается; `''` — имя неизвестно. */
  name(userId: number | undefined): Signal<string | null> {
    if (userId !== undefined) this.request(userId);

    return computed(() => (userId === undefined ? '' : (this.names().get(userId) ?? null)));
  }

  /** Имена всех переданных пользователей; отсутствующие запрашиваются. */
  namesOf(userIds: readonly (number | undefined)[]): Signal<ReadonlyMap<number, string>> {
    userIds.forEach((id) => id !== undefined && this.request(id));

    return this.names;
  }

  private request(userId: number): void {
    if (this.requested.has(userId)) return;

    this.requested.add(userId);
    this.api.ofUser(userId).subscribe({
      next: (profile) =>
        this.set(userId, [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(' ')),
      error: () => this.set(userId, ''),
    });
  }

  private set(userId: number, name: string): void {
    this.names.update((names) => new Map(names).set(userId, name));
  }
}
