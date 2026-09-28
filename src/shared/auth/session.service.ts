import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { skipErrorToast } from '../api/http-context';
import { environment } from '../config/environment';
import { type AccessRule, hasAccess } from './access-groups';
import { signInUrlFor } from './areas';
import type { AuthMethod, Session, TokenResponse } from './auth.models';
import { stageExerciseOf } from './jwt';

const STORAGE_KEY = 'ejs2.session';
/** Ключи сессии v1: после переключения на бэкенд v2 они недействительны. */
const LEGACY_KEYS = ['token', 'user', 'fullName', 'type', 'exerciseId', 'exerciseIds'];

/**
 * Единственное место, которое читает и пишет токен и профиль.
 * Refresh-токена в v2 нет: за `SESSION_WARNING_SECONDS` до истечения поднимается `expiringSoon`,
 * по истечении — выход на страницу входа.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly storage = safeStorage(this.document.defaultView);
  private readonly state = signal<Session | null>(null);
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  readonly session = this.state.asReadonly();
  readonly user = computed(() => this.state()?.user ?? null);
  readonly roles = computed(() => this.state()?.user.roles ?? []);
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly stage = computed(() => this.state()?.stage ?? null);
  readonly expiringSoon = signal(false);

  constructor() {
    LEGACY_KEYS.forEach((key) => this.storage?.removeItem(key));
    this.apply(this.restore());

    const view = this.document.defaultView;
    const onStorage = (event: StorageEvent) => event.key === STORAGE_KEY && this.apply(this.restore());

    view?.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => {
      view?.removeEventListener('storage', onStorage);
      this.clearTimers();
    });
  }

  token(): string | null {
    return this.state()?.accessToken ?? null;
  }

  can(rule: AccessRule): boolean {
    return hasAccess(this.isAuthenticated() ? this.roles() : null, rule);
  }

  start(response: TokenResponse, method: AuthMethod): void {
    const session: Session = {
      accessToken: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      user: response.user,
      method,
      stage: stageExerciseOf(response.accessToken),
    };

    this.storage?.setItem(STORAGE_KEY, JSON.stringify(session));
    this.apply(session);
  }

  /**
   * Выход по кнопке: `POST /v1/auth/logout` отзывает все токены пользователя,
   * для входа через ЕСИА — ещё переход по `GET /v1/auth/esia/logout-url`.
   */
  async logout(): Promise<void> {
    const session = this.state();
    const signInUrl = signInUrlFor(this.router.url);

    if (!session) {
      await this.router.navigateByUrl(signInUrl);

      return;
    }

    const esiaLogoutUrl = session.method === 'esia' ? await this.fetchEsiaLogoutUrl() : null;

    await firstValueFrom(
      this.http.post<void>(`${environment.AUTH_API}/logout`, null, { context: skipErrorToast() }),
    ).catch(() => undefined);
    this.clear();

    if (esiaLogoutUrl) this.document.location.assign(esiaLogoutUrl);
    else await this.router.navigateByUrl(signInUrl);
  }

  /** Сессия закончилась: 401 от шлюза (срок, отзыв, смена ролей, блокировка) или истёк `expiresIn`. */
  expire(): void {
    if (!this.state()) return;

    const returnUrl = this.router.url;

    this.clear();
    void this.router.navigate([signInUrlFor(returnUrl)], { queryParams: { returnUrl, expired: 1 } });
  }

  clear(): void {
    this.storage?.removeItem(STORAGE_KEY);
    this.apply(null);
  }

  private apply(session: Session | null): void {
    this.clearTimers();
    this.state.set(session);
    this.expiringSoon.set(false);

    if (!session) return;

    const left = session.expiresAt - Date.now();
    const warnIn = left - environment.SESSION_WARNING_SECONDS * 1000;

    if (left <= 0) {
      this.storage?.removeItem(STORAGE_KEY);
      this.state.set(null);

      return;
    }

    this.timers.push(setTimeout(() => this.expiringSoon.set(true), Math.max(warnIn, 0)));
    this.timers.push(setTimeout(() => this.expire(), left));
  }

  private restore(): Session | null {
    const raw = this.storage?.getItem(STORAGE_KEY);

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<Session>;

      return parsed.accessToken && parsed.user && typeof parsed.expiresAt === 'number' ? (parsed as Session) : null;
    } catch {
      return null;
    }
  }

  private async fetchEsiaLogoutUrl(): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ url: string }>(`${environment.AUTH_API}/esia/logout-url`, { context: skipErrorToast() }),
      );

      return response.url || null;
    } catch {
      return null;
    }
  }

  private clearTimers(): void {
    this.timers.splice(0).forEach((timer) => clearTimeout(timer));
  }
}

function safeStorage(view: Window | null): Storage | null {
  try {
    return view?.localStorage ?? null;
  } catch {
    return null;
  }
}
