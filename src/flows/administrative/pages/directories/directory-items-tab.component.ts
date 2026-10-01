import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

import type { DirectoryCode, Schemas } from '@domain/api/api.types';
import { DirectoryApi } from '@domain/api/directory.api';
import { DirectoryStore } from '@domain/stores/directory.store';
import { localized } from '@shared/lib/language';
import { NotifyService } from '@shared/ui/notify.service';

import { DirectoryItemDialogComponent } from './directory-item-dialog.component';
import { ALL_DIRECTORY_CODES, isEditable, isExternal } from './directory-rules';

type Item = Schemas['DirectoryItemResponse'];

const PAGE_SIZE = 20;

/**
 * Записи справочника: код → поиск, страница, включение/выключение; создание и правка у локальных справочников,
 * синхронизация у внешних (`GET|POST|PUT /directory/{code}`, `PATCH .../active`, `POST .../sync`).
 */
@Component({
  selector: 'app-directory-items-tab',
  imports: [
    FormsModule,
    LangPipe,
    Button,
    InputText,
    Paginator,
    Select,
    Skeleton,
    Tag,
    ToggleSwitch,
    DirectoryItemDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './directory-items-tab.component.html',
})
export class DirectoryItemsTabComponent implements OnInit {
  private readonly api = inject(DirectoryApi);
  private readonly store = inject(DirectoryStore);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput = new Subject<string>();

  protected readonly size = PAGE_SIZE;
  protected readonly code = signal<DirectoryCode>('DOCUMENT_TYPE');
  protected readonly search = signal('');
  protected readonly activeOnly = signal(true);
  protected readonly items = signal<Item[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly busy = signal<number | null>(null);
  protected readonly syncing = signal(false);
  protected readonly editing = signal(false);
  protected readonly selected = signal<Item | null>(null);

  protected readonly editable = computed(() => isEditable(this.code()));
  protected readonly external = computed(() => isExternal(this.code()));
  protected readonly codeOptions = computed(() => {
    this.lang.currentLang();

    return ALL_DIRECTORY_CODES.map((value) => ({ value, label: this.lang.get(`staff-directories.code.${value}`) }));
  });

  ngOnInit(): void {
    this.searchInput
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.load(0);
      });
    this.load(0);
  }

  protected setCode(code: DirectoryCode): void {
    this.code.set(code);
    this.load(0);
  }

  protected setSearch(value: string): void {
    this.searchInput.next(value.trim());
  }

  protected setActiveOnly(value: boolean): void {
    this.activeOnly.set(value);
    this.load(0);
  }

  protected onPage(state: PaginatorState): void {
    this.load(Math.floor((state.first ?? 0) / PAGE_SIZE));
  }

  protected name(item: Item): string {
    return localized(item.nameRu, item.nameKg, this.lang.currentLang());
  }

  protected open(item: Item | null): void {
    this.selected.set(item);
    this.editing.set(true);
  }

  protected reload(): void {
    this.load(this.page());
  }

  protected toggle(item: Item): void {
    const id = item.id;

    if (id === undefined) return;

    this.busy.set(id);
    this.api.setActive(this.code(), id, item.active === false).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.store.invalidate(this.code());
        this.items.update((items) => items.map((row) => (row.id === updated.id ? updated : row)));
      },
      error: () => this.busy.set(null),
    });
  }

  protected sync(): void {
    const code = this.code();

    this.confirm.confirm({
      header: this.lang.get('staff-directories.items.sync'),
      message: this.lang.get('staff-directories.items.sync-message', {
        code: this.lang.get(`staff-directories.code.${code}`),
      }),
      icon: 'pi pi-sync',
      acceptLabel: this.lang.get('staff-directories.items.sync'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.syncing.set(true);
        this.api.sync(code).subscribe({
          next: (result) => {
            this.syncing.set(false);
            this.store.invalidate(code);
            this.notify.success(this.lang.get('staff-directories.items.sync-result', result));
            this.load(0);
          },
          error: () => this.syncing.set(false),
        });
      },
    });
  }

  private load(page: number): void {
    this.page.set(page);
    this.loading.set(true);
    this.api
      .page(this.code(), {
        search: this.search() || undefined,
        activeOnly: this.activeOnly(),
        page,
        size: PAGE_SIZE,
        sort: 'sortOrder,asc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.items.set(result.content);
          this.total.set(result.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
