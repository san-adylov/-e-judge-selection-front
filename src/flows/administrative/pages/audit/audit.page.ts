import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  type OnInit,
  signal,
  type TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import type { GridColumns, RenderTemplateData } from '@reforgium/data-grid';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';

import type { Schemas } from '@domain/api/api.types';
import { AuditApi, type AuditFilter } from '@domain/api/audit.api';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { DataTableComponent, type TablePage } from '@shared/ui/data-table/data-table.component';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { AUDIT_ACTION_TYPES, AUDIT_ENTITY_TYPES, normalizeEventType } from './audit-rules';

type Entry = Schemas['AuditLogResponse'];

/** Журнал аудита (`GET /audit`, администратор): фильтры контроллера, страница по 50, карточка записи по клику. */
@Component({
  selector: 'app-audit-page',
  imports: [
    FormsModule,
    LangPipe,
    ServerDateTimePipe,
    Button,
    DatePicker,
    Dialog,
    InputText,
    Select,
    Tag,
    DataTableComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit.page.html',
})
export default class AuditPage implements OnInit {
  private readonly api = inject(AuditApi);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateTime = new ServerDateTimePipe();

  private readonly resultCell = viewChild.required<TemplateRef<RenderTemplateData<Entry>>>('resultCell');
  private readonly requestCell = viewChild.required<TemplateRef<RenderTemplateData<Entry>>>('requestCell');

  protected readonly rows = signal<Entry[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(50);
  protected readonly username = signal('');
  protected readonly eventType = signal('');
  protected readonly entityType = signal<string | null>(null);
  protected readonly actionType = signal<string | null>(null);
  protected readonly success = signal<boolean | null>(null);
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);
  protected readonly selected = signal<Entry | null>(null);
  protected readonly detailsOpen = signal(false);

  protected readonly entityOptions = computed(() => {
    this.lang.currentLang();

    return AUDIT_ENTITY_TYPES.map((value) => ({ value, label: this.lang.get(`staff-audit.entity.${value}`) }));
  });
  protected readonly actionOptions = computed(() => {
    this.lang.currentLang();

    return AUDIT_ACTION_TYPES.map((value) => ({ value, label: this.lang.get(`staff-audit.action.${value}`) }));
  });
  protected readonly successOptions = computed(() => {
    this.lang.currentLang();

    return [
      { value: true, label: this.lang.get('staff-audit.result.success') },
      { value: false, label: this.lang.get('staff-audit.result.failure') },
    ];
  });

  protected readonly columns = computed<GridColumns<Entry>>(() => {
    this.lang.currentLang();

    const header = (key: string) => this.lang.get(`staff-audit.columns.${key}`);
    const track = (row: Entry) => String(row.id);

    return [
      {
        key: 'occurredAt',
        header: header('occurred-at'),
        minWidth: 150,
        track,
        value: (row) => this.dateTime.transform(row.occurredAt),
      },
      {
        key: 'username',
        header: header('user'),
        minWidth: 160,
        track,
        value: (row) => row.username || (row.userId ? `#${row.userId}` : '—'),
      },
      {
        key: 'eventType',
        header: header('event'),
        flex: 2,
        minWidth: 220,
        track,
        value: (row) => row.eventType || '—',
      },
      {
        key: 'entityType',
        header: header('entity'),
        minWidth: 180,
        track,
        value: (row) => (row.entityType ? this.lang.get(`staff-audit.entity.${row.entityType}`) : '—'),
      },
      {
        key: 'actionType',
        header: header('action'),
        minWidth: 130,
        track,
        value: (row) => (row.actionType ? this.lang.get(`staff-audit.action.${row.actionType}`) : '—'),
      },
      { key: 'uri', header: header('request'), flex: 2, minWidth: 240, track, renderTemplate: this.requestCell() },
      { key: 'success', header: header('result'), minWidth: 120, track, renderTemplate: this.resultCell() },
    ];
  });

  ngOnInit(): void {
    this.load(0);
  }

  protected apply(): void {
    this.load(0);
  }

  protected reset(): void {
    this.username.set('');
    this.eventType.set('');
    this.entityType.set(null);
    this.actionType.set(null);
    this.success.set(null);
    this.from.set(null);
    this.to.set(null);
    this.load(0);
  }

  protected onPage({ page, size }: TablePage): void {
    this.size.set(size);
    this.load(page);
  }

  protected open(entry: Entry): void {
    this.selected.set(entry);
    this.detailsOpen.set(true);
  }

  private load(page: number): void {
    const filter: AuditFilter = {
      username: this.username().trim() || undefined,
      eventType: normalizeEventType(this.eventType()),
      entityType: this.entityType() ?? undefined,
      actionType: this.actionType() ?? undefined,
      success: this.success() ?? undefined,
      from: this.from()?.toISOString(),
      to: this.to()?.toISOString(),
      page,
      size: this.size(),
      sort: 'occurredAt,desc',
    };

    this.loading.set(true);
    this.api
      .list(filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.rows.set(result.content);
          this.total.set(result.totalElements);
          this.page.set(result.page);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
