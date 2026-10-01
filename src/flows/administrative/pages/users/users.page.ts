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
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

import type { AuthRole, AuthSchemas, UserStatus } from '@domain/api/api.types';
import { UsersApi } from '@domain/api/users.api';
import { AccessDirective } from '@shared/auth/access.directive';
import { ROLES } from '@shared/auth/access-groups';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { DataTableComponent, type TablePage } from '@shared/ui/data-table/data-table.component';
import { NotifyService } from '@shared/ui/notify.service';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { UserCreateDialogComponent } from './user-create-dialog.component';
import { UserRolesDialogComponent } from './user-roles-dialog.component';

type User = AuthSchemas['UserResponse'];

/**
 * Пользователи (`GET /users`): список видят SUPER_ADMIN, ADMIN, CHAIRMAN и VICE_CHAIRMAN; администраторы
 * в списке не показываются. Регистрация, смена статуса и ролей — ADMIN.
 */
@Component({
  selector: 'app-users-page',
  imports: [
    FormsModule,
    LangPipe,
    Button,
    DatePicker,
    InputText,
    Select,
    AccessDirective,
    DataTableComponent,
    PageHeaderComponent,
    StatusTagComponent,
    UserCreateDialogComponent,
    UserRolesDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.page.html',
})
export default class UsersPage implements OnInit {
  private readonly api = inject(UsersApi);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateTime = new ServerDateTimePipe();
  private readonly searchInput = new Subject<string>();

  private readonly rolesCell = viewChild.required<TemplateRef<RenderTemplateData<User>>>('rolesCell');
  private readonly statusCell = viewChild.required<TemplateRef<RenderTemplateData<User>>>('statusCell');
  private readonly actionsCell = viewChild.required<TemplateRef<RenderTemplateData<User>>>('actionsCell');

  protected readonly canEdit = inject(SessionService).can('ADMIN');
  protected readonly rows = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly query = signal('');
  protected readonly role = signal<AuthRole | null>(null);
  protected readonly createdFrom = signal<Date | null>(null);
  protected readonly createdTo = signal<Date | null>(null);
  protected readonly busy = signal<number | null>(null);
  protected readonly creating = signal(false);
  protected readonly editingRoles = signal(false);
  protected readonly selected = signal<User | null>(null);

  protected readonly roleOptions = computed(() => {
    this.lang.currentLang();

    return ROLES.map((value) => ({ value, label: this.lang.get(`status.role.${value}`) }));
  });

  protected readonly columns = computed<GridColumns<User>>(() => {
    this.lang.currentLang();

    const header = (key: string) => this.lang.get(`staff-users.columns.${key}`);
    const track = (row: User) => String(row.id);
    const columns: GridColumns<User> = [
      { key: 'fullName', header: header('name'), flex: 2, minWidth: 220, track, value: (row) => fullName(row) },
      { key: 'username', header: header('username'), minWidth: 150, track, value: (row) => row.username || '—' },
      { key: 'pin', header: header('pin'), minWidth: 150, track, value: (row) => row.pin || '—' },
      { key: 'roles', header: header('roles'), flex: 2, minWidth: 220, track, renderTemplate: this.rolesCell() },
      { key: 'status', header: header('status'), minWidth: 140, track, renderTemplate: this.statusCell() },
      {
        key: 'createdAt',
        header: header('created-at'),
        minWidth: 150,
        track,
        value: (row) => this.dateTime.transform(row.createdAt),
      },
    ];

    if (this.canEdit) columns.push({ key: 'id', header: '', minWidth: 130, track, renderTemplate: this.actionsCell() });

    return columns;
  });

  ngOnInit(): void {
    this.searchInput
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.query.set(value);
        this.load(0);
      });
    this.load(0);
  }

  protected setQuery(value: string): void {
    this.searchInput.next(value.trim());
  }

  protected setRole(role: AuthRole | null): void {
    this.role.set(role ?? null);
    this.load(0);
  }

  protected setCreatedFrom(date: Date | null): void {
    this.createdFrom.set(date);
    this.load(0);
  }

  protected setCreatedTo(date: Date | null): void {
    this.createdTo.set(date);
    this.load(0);
  }

  protected onPage({ page, size }: TablePage): void {
    this.size.set(size);
    this.load(page);
  }

  protected reload(): void {
    this.load(this.page());
  }

  protected openRoles(user: User): void {
    this.selected.set(user);
    this.editingRoles.set(true);
  }

  protected replace(user: User): void {
    this.rows.update((rows) => rows.map((row) => (row.id === user.id ? user : row)));
  }

  /** Блокировка, разблокировка и удаление — через подтверждение: смена статуса завершает сессии пользователя. */
  protected changeStatus(user: User, status: UserStatus): void {
    const id = user.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get(`staff-users.status.${status}-title`),
      message: this.lang.get(`staff-users.status.${status}-message`, { name: fullName(user) }),
      icon: status === 'ACTIVE' ? 'pi pi-unlock' : 'pi pi-lock',
      acceptLabel: this.lang.get('shell.actions.confirm'),
      acceptButtonProps: { severity: status === 'ACTIVE' ? 'primary' : 'danger' },
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.busy.set(id);
        this.api.changeStatus(id, status).subscribe({
          next: (updated) => {
            this.busy.set(null);
            this.notify.success(this.lang.get('shell.form.saved'));
            this.replace(updated);
          },
          error: () => this.busy.set(null),
        });
      },
    });
  }

  private load(page: number): void {
    const to = this.createdTo();
    const toEnd = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1) : null;

    this.loading.set(true);
    this.api
      .list({
        query: this.query() || undefined,
        role: this.role() ?? undefined,
        createdFrom: this.createdFrom()?.toISOString(),
        createdTo: toEnd?.toISOString(),
        page,
        size: this.size(),
        sort: 'createdAt,desc',
      })
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

function fullName(user: User): string {
  return (
    user.fullName ||
    [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ') ||
    user.username ||
    `#${user.id}`
  );
}
