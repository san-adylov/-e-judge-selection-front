import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { catchError, EMPTY, finalize, of, switchMap, throwError } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { CandidateProfileApi } from '@domain/api/candidate-profile.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { apiErrorOf, ERROR_CODES } from '@shared/api/api-error';
import { backendLangOf } from '@shared/lib/language';
import { NotifyService } from '@shared/ui/notify.service';

import { buildApplicationDraft } from './application-draft';

/** Коды отказа `SubmissionRules` бэкенда при создании черновика. */
export const APPLY_ERRORS = {
  PROFILE_INCOMPLETE: 4137,
  BANNED: 4153,
  ALREADY_EXISTS: 4091,
  ACTIVE_SAME_TYPE: 4102,
} as const;

function isNotFound(error: unknown): boolean {
  return (
    (error instanceof HttpErrorResponse && error.status === 404) ||
    apiErrorOf(error)?.errorCode === ERROR_CODES.NOT_FOUND
  );
}

/**
 * Подача заявки на конкурс: подтверждение → проверка отстранения → черновик с контактами из профиля →
 * мастер заявки `/cabinet/applications/:id/edit`. Провайдер уровня страницы: `providers: [ContestApplyService]`.
 * Ошибки бэкенда уже показаны тостом интерцептора; здесь — только реакция на них.
 */
@Injectable()
export class ContestApplyService {
  private readonly profiles = inject(CandidateProfileApi);
  private readonly applications = inject(ContestApplicationApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly lang = inject(LangService);
  private readonly notify = inject(NotifyService);

  readonly ban = signal<Schemas['BanStatusResponse'] | null>(null);
  readonly banned = computed(() => this.ban()?.banned === true);
  /** Конкурс, по которому сейчас создаётся заявка. */
  readonly pending = signal<number | null>(null);
  /** Конкурс, для которого нужно дозаполнить личное дело (4137 или нет личных данных). */
  readonly profileHint = signal<number | null>(null);

  loadBanStatus(): void {
    this.profiles.banStatus().subscribe((ban) => this.ban.set(ban));
  }

  /** `onStale` — данные на экране устарели (заявка уже есть, 4091): страница перезагружает список. */
  apply(contest: { id?: number; name?: string }, onStale?: () => void): void {
    const contestId = contest.id;

    if (contestId === undefined || this.pending() !== null) return;

    this.confirm.confirm({
      header: this.lang.get('contests.apply.confirm-header'),
      message: this.lang.get('contests.apply.confirm-message', { name: contest.name ?? '' }),
      icon: 'pi pi-file-edit',
      acceptLabel: this.lang.get('contests.apply.confirm-accept'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.create(contestId, onStale),
    });
  }

  private create(contestId: number, onStale?: () => void): void {
    this.pending.set(contestId);
    this.profileHint.set(null);

    this.profiles
      .banStatus()
      .pipe(
        switchMap((ban) => {
          this.ban.set(ban);

          if (ban.banned) return EMPTY;

          return this.profiles
            .my()
            .pipe(catchError((error) => (isNotFound(error) ? of(null) : throwError(() => error))));
        }),
        switchMap((profile) => {
          if (!profile) {
            this.profileHint.set(contestId);

            return EMPTY;
          }

          const draft = buildApplicationDraft(profile, backendLangOf(this.lang.currentLang()));

          return this.applications.create(contestId, draft);
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
        error: (error: unknown) => this.onError(error, contestId, onStale),
      });
  }

  private onError(error: unknown, contestId: number, onStale?: () => void): void {
    switch (apiErrorOf(error)?.errorCode) {
      case APPLY_ERRORS.PROFILE_INCOMPLETE:
        this.profileHint.set(contestId);
        break;
      case APPLY_ERRORS.BANNED:
        this.loadBanStatus();
        break;
      case APPLY_ERRORS.ALREADY_EXISTS:
        onStale?.();
        break;
    }
  }
}
