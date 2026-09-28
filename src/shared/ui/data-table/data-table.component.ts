import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DataGrid, DataGridCellEmptyDirective, type GridColumns } from '@reforgium/data-grid';
import { LangPipe } from '@reforgium/presentia';
import { Paginator, type PaginatorState } from 'primeng/paginator';

type Row = Record<string, unknown>;

export interface TablePage {
  /** Номер страницы с нуля — как `page` у Spring `Pageable`. */
  page: number;
  size: number;
}

/**
 * Единственная таблица приложения: обёртка над `@reforgium/data-grid` + пагинатор PrimeNG.
 * Экраны не импортируют `re-data-grid` и `p-table` напрямую — при замене библиотеки меняется только этот файл.
 */
@Component({
  selector: 'app-data-table',
  imports: [DataGrid, DataGridCellEmptyDirective, Paginator, LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <re-data-grid
      loadingMode="skeleton"
      [data]="rows()"
      [columns]="columns()"
      [loading]="loading()"
      [rowHeight]="rowHeight()"
      [pageSize]="size()"
      (rowClick)="rowClick.emit($event.row)"
    >
      <ng-template reDataGridEmpty>{{ emptyText() | lang }}</ng-template>
    </re-data-grid>

    @if (total() > size()) {
      <p-paginator
        [rows]="size()"
        [first]="page() * size()"
        [totalRecords]="total()"
        [rowsPerPageOptions]="sizeOptions()"
        (onPageChange)="onPage($event)"
      />
    }
  `,
})
export class DataTableComponent<T extends Row = Row> {
  readonly rows = input<T[]>([]);
  readonly columns = input.required<GridColumns<T>>();
  readonly loading = input(false);
  readonly total = input(0);
  readonly page = input(0);
  readonly size = input(20);
  readonly sizeOptions = input([10, 20, 50]);
  readonly rowHeight = input(56);
  /** Ключ i18n текста пустой таблицы. */
  readonly emptyText = input('shell.table.empty');

  readonly pageChange = output<TablePage>();
  readonly rowClick = output<T>();

  protected onPage(state: PaginatorState): void {
    const size = state.rows ?? this.size();

    this.pageChange.emit({ page: Math.floor((state.first ?? 0) / size), size });
  }
}
