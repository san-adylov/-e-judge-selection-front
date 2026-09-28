import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@shared/config/environment';

import {
  type AuthRole,
  type AuthSchemas as A,
  type Page,
  type PageQuery,
  toParams,
  type UserStatus,
} from './api.types';

const USERS = `${environment.API}/users`;

type User = A['UserResponse'];

/** `UserController` (auth-service). Смена статуса или ролей завершает все сессии пользователя. */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  me(): Observable<User> {
    return this.http.get<User>(`${USERS}/me`);
  }

  list(query: A['UserFilter'] & PageQuery = {}): Observable<Page<User>> {
    return this.http.get<Page<User>>(USERS, { params: toParams(query) });
  }

  boardMembers(activeOnly = false): Observable<User[]> {
    return this.http.get<User[]>(`${USERS}/board-members`, { params: toParams({ activeOnly }) });
  }

  changeStatus(id: number, status: UserStatus): Observable<User> {
    return this.http.patch<User>(`${USERS}/${id}/status`, { status } satisfies A['ChangeStatusRequest']);
  }

  changeRoles(id: number, roles: AuthRole[]): Observable<User> {
    return this.http.put<User>(`${USERS}/${id}/roles`, { roles } satisfies A['ChangeRolesRequest']);
  }
}
