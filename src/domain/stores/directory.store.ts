import { computed, inject, Injectable, type Signal, signal, type WritableSignal } from '@angular/core';
import { LangService } from '@reforgium/presentia';

import { localized } from '@shared/lib/language';

import type { DirectoryCode, Schemas as S } from '../api/api.types';
import { DirectoryApi } from '../api/directory.api';

type Item = S['DirectoryItemResponse'];

export interface DirectoryOption {
  label: string;
  value: number;
}

/** Справочники с кешем на время жизни вкладки: один запрос `GET /v1/directory/{CODE}/all` на код. */
@Injectable({ providedIn: 'root' })
export class DirectoryStore {
  private readonly api = inject(DirectoryApi);
  private readonly lang = inject(LangService);
  private readonly cache = new Map<DirectoryCode, WritableSignal<Item[] | null>>();

  items(code: DirectoryCode): Signal<Item[]> {
    const state = this.state(code);

    return computed(() => state() ?? []);
  }

  /** Активные записи для `p-select`: подпись на текущем языке, значение — id. */
  options(code: DirectoryCode): Signal<DirectoryOption[]> {
    const state = this.state(code);

    return computed(() => {
      const lang = this.lang.currentLang();

      return (state() ?? [])
        .filter((item) => item.active !== false && item.id !== undefined)
        .map((item) => ({ label: localized(item.nameRu, item.nameKg, lang), value: item.id as number }));
    });
  }

  /** `true`, когда `items(code)` загружен: пустой список до загрузки не отличить от пустого справочника. */
  loaded(code: DirectoryCode): Signal<boolean> {
    const state = this.state(code);

    return computed(() => state() !== null);
  }

  invalidate(code: DirectoryCode): void {
    this.cache.delete(code);
  }

  private state(code: DirectoryCode): WritableSignal<Item[] | null> {
    let state = this.cache.get(code);

    if (!state) {
      const created = signal<Item[] | null>(null);

      state = created;
      this.cache.set(code, created);
      this.api.all(code).subscribe({ next: (items) => created.set(items), error: () => this.cache.delete(code) });
    }

    return state;
  }
}
