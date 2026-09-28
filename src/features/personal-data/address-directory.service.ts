import { inject, Injectable, type Signal, signal, untracked, type WritableSignal } from '@angular/core';
import { LangService } from '@reforgium/presentia';

import type { DirectoryCode, Schemas } from '@domain/api/api.types';
import { DirectoryApi } from '@domain/api/directory.api';
import { type DirectoryOption, DirectoryStore } from '@domain/stores/directory.store';
import { localized } from '@shared/lib/language';

type Item = Schemas['DirectoryItemResponse'];

/** Иерархические справочники адреса: регион → район → город → улица (`parentId`). */
export type AddressLevel = Extract<DirectoryCode, 'DISTRICT' | 'CITY' | 'STREET'>;

/** Размер страницы дочерних записей: весь список одного родителя в выпадающем списке. */
const CHILDREN_PAGE_SIZE = 1000;

/**
 * Каскад адреса по `GET /v1/directory/{CODE}?parentId=`. Если у родителя нет дочерних записей (иерархия
 * справочника не заполнена) — показываем весь справочник (`/all`), чтобы адрес всё равно можно было указать.
 * Методы вызываются внутри `computed`: запросы стартуют вне реактивного контекста и кешируются на вкладку.
 */
@Injectable({ providedIn: 'root' })
export class AddressDirectoryService {
  private readonly api = inject(DirectoryApi);
  private readonly store = inject(DirectoryStore);
  private readonly lang = inject(LangService);
  private readonly children = new Map<string, WritableSignal<Item[] | null>>();
  private readonly all = new Map<DirectoryCode, Signal<Item[]>>();
  private readonly single = new Map<string, WritableSignal<Item | null>>();

  /** Варианты для `p-select`; `parentId = null` — весь справочник. */
  options(code: AddressLevel, parentId: number | null): DirectoryOption[] {
    const items = parentId === null ? this.allOf(code)() : this.childrenOf(code, parentId)();

    return this.toOptions(items ?? []);
  }

  /** Подпись записи по id для режима просмотра: `GET /v1/directory/{CODE}/{id}`. */
  label(code: DirectoryCode, id: number | null | undefined): string {
    if (id === null || id === undefined) return '';

    const item = this.itemOf(code, id)();

    return item ? localized(item.nameRu, item.nameKg, this.lang.currentLang()) : '';
  }

  private toOptions(items: Item[]): DirectoryOption[] {
    const lang = this.lang.currentLang();

    return items
      .filter((item) => item.active !== false && item.id !== undefined)
      .map((item) => ({ label: localized(item.nameRu, item.nameKg, lang), value: item.id as number }));
  }

  private allOf(code: DirectoryCode): Signal<Item[]> {
    let state = this.all.get(code);

    if (!state) {
      state = untracked(() => this.store.items(code));
      this.all.set(code, state);
    }

    return state;
  }

  /** `null` — загружается; пустой ответ → весь справочник. */
  private childrenOf(code: AddressLevel, parentId: number): Signal<Item[] | null> {
    const key = `${code}:${parentId}`;
    const cached = this.children.get(key);

    if (cached) {
      const items = cached();

      return items !== null && items.length === 0 ? this.allOf(code) : cached;
    }

    const state = signal<Item[] | null>(null);

    this.children.set(key, state);
    untracked(() =>
      this.api.page(code, { parentId, size: CHILDREN_PAGE_SIZE }).subscribe({
        next: (page) => state.set(page.content),
        error: () => this.children.delete(key),
      }),
    );

    return state;
  }

  private itemOf(code: DirectoryCode, id: number): Signal<Item | null> {
    const key = `${code}#${id}`;
    let state = this.single.get(key);

    if (!state) {
      const created = signal<Item | null>(null);

      state = created;
      this.single.set(key, created);
      untracked(() => this.api.get(code, id).subscribe({ next: (item) => created.set(item), error: () => undefined }));
    }

    return state;
  }
}
