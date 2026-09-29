import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { catchError, EMPTY, finalize, map, type Observable, of, Subject, switchMap, tap } from 'rxjs';

import type { ContestType, Schemas } from '@domain/api/api.types';
import { CandidateProfileApi } from '@domain/api/candidate-profile.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { apiErrorOf } from '@shared/api/api-error';
import { skipErrorToast } from '@shared/api/http-context';
import { backendLangOf } from '@shared/lib/language';
import { NotifyService } from '@shared/ui/notify.service';

import { buildApplicationDraft } from './application-draft';

type Profile = Schemas['ProfileResponse'];

/** Коды отказа `ApplicationSubmissionService.createDraft` бэкенда. */
export const APPLY_ERRORS = {
  /** Нет личных данных (даты рождения) для проверки возраста. */
  PROFILE_INCOMPLETE: 4137,
  BANNED: 4153,
  ALREADY_EXISTS: 4091,
  ACTIVE_SAME_TYPE: 4102,
  EXPIRED: 4093,
  NOT_STARTED: 4146,
  NOT_PUBLISHED: 4321,
} as const;

/** После этих отказов данные на экране устарели — страница перечитывает конкурсы. */
const STALE_ERRORS: ReadonlySet<number> = new Set([
  APPLY_ERRORS.ALREADY_EXISTS,
  APPLY_ERRORS.ACTIVE_SAME_TYPE,
  APPLY_ERRORS.EXPIRED,
  APPLY_ERRORS.NOT_STARTED,
  APPLY_ERRORS.NOT_PUBLISHED,
]);

/**
 * Подача заявки на конкурс: подтверждение → проверка отстранения → черновик с контактами из личных данных →
 * мастер заявки `/cabinet/applications/:id/edit`. Провайдер уровня страницы: `providers: [ContestApplyService]`.
 * Ошибки `create` уже показаны тостом интерцептора; здесь — только реакция на них.
 */
@Injectable()
export class ContestApplyService {
  private readonly profiles = inject(CandidateProfileApi);
  private readonly applications = inject(ContestApplicationApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly lang = inject(LangService);
  private readonly notify = inject(NotifyService);
  private readonly staleEvents = new Subject<void>();

  /** Данные на экране устарели (отказ 4091, 4102 или по срокам приёма): страница перечитывает конкурсы. */
  readonly stale = this.staleEvents.asObservable();
  readonly ban = signal<Schemas['BanStatusResponse'] | null>(null);
  readonly banned = computed(() => this.ban()?.banned === true);
  /** Конкурс, по которому сейчас создаётся заявка. */
  readonly pending = signal<number | null>(null);
  /** Конкурс, для которого нужно заполнить личные данные (отказ 4137 или их ещё нет). */
  readonly profileHint = signal<number | null>(null);
  /**
   * Типы конкурсов, по которым бэкенд отказал 4102 (`null` — конкурсы без типа). Мешающая заявка может быть
   * не видна фронту — после отказа такие конкурсы больше не предлагают «Подать заявку».
   */
  readonly refusedTypes = signal<ReadonlySet<ContestType | null>>(new Set());

  /** Ошибка проверки не мешает работе: окончательно отстранение проверит бэкенд (4153). */
  loadBanStatus(): void {
    this.checkBan().subscribe();
  }

  /** Подтверждение и создание черновика; после отказа 4091, 4102 или по срокам приёма срабатывает `stale`. */
  apply(contest: { id?: number; name?: string; type?: ContestType | null }): void {
    const contestId = contest.id;
    const type = contest.type ?? null;

    if (contestId === undefined || this.pending() !== null || this.banned()) return;

    this.confirm.confirm({
      header: this.lang.get('contests.apply.confirm-header'),
      message: this.lang.get('contests.apply.confirm-message', { name: contest.name ?? '' }),
      icon: 'pi pi-file-edit',
      acceptLabel: this.lang.get('contests.apply.confirm-accept'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.create(contestId, type),
    });
  }

  private create(contestId: number, type: ContestType | null): void {
    this.pending.set(contestId);
    this.profileHint.set(null);

    this.checkBan()
      .pipe(
        switchMap((banned) => (banned ? EMPTY : this.profile())),
        switchMap((profile) => {
          if (profile === null) {
            this.profileHint.set(contestId);

            return EMPTY;
          }

          return this.applications.create(
            contestId,
            buildApplicationDraft(profile, backendLangOf(this.lang.currentLang())),
          );
        }),
        finalize(() => this.pending.set(null)),
      )
      .subscribe({
        next: (application) => {
          this.notify.success(this.lang.get('contests.apply.created'));
          void this.router.navigate(
            application.id === undefined
              ? ['/cabinet/applications']
              : ['/cabinet/applications', application.id, 'edit'],
          );
        },
        error: (error: unknown) => this.onError(error, contestId, type),
      });
  }

  /** `true` — кандидат отстранён; при ошибке запроса — `false`, решает бэкенд. */
  private checkBan(): Observable<boolean> {
    return this.profiles.banStatus(skipErrorToast()).pipe(
      tap((ban) => this.ban.set(ban)),
      map((ban) => ban.banned === true),
      catchError(() => of(false)),
    );
  }

  /**
   * Личные данные для контактов черновика: `null` — ещё не заполнены (404) и бэкенд откажет 4137;
   * `undefined` — загрузить не удалось, черновик создаётся без контактов (кандидат дополнит их в мастере).
   */
  private profile(): Observable<Profile | null | undefined> {
    return this.profiles
      .my(skipErrorToast())
      .pipe(
        catchError((error: unknown) =>
          of(error instanceof HttpErrorResponse && error.status === 404 ? null : undefined),
        ),
      );
  }

  private onError(error: unknown, contestId: number, type: ContestType | null): void {
    const code = apiErrorOf(error)?.errorCode;

    if (code === APPLY_ERRORS.PROFILE_INCOMPLETE) this.profileHint.set(contestId);
    if (code === APPLY_ERRORS.BANNED) this.loadBanStatus();
    if (code === APPLY_ERRORS.ACTIVE_SAME_TYPE) this.refusedTypes.update((types) => new Set(types).add(type));
    if (code !== undefined && STALE_ERRORS.has(code)) this.staleEvents.next();
  }
}
