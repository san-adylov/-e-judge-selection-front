import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LangService } from '@reforgium/presentia';
import { catchError, filter, forkJoin, type Observable, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApi } from '@domain/api/contest.api';
import { ReserveApi } from '@domain/api/reserve.api';
import { VacanciesApi } from '@domain/api/vacancies.api';
import { SseService } from '@shared/api/sse.service';
import { NotifyService } from '@shared/ui/notify.service';

import { type Reserve, type Vacancy, VACANCY_NOTIFICATION_TYPES, type VacancyApplication } from './vacancy-rules';

type Contest = Schemas['ContestResponse'];

export const VACANCIES_PAGE_SIZE = 10;

/** Данные экрана вакансий: доступные вакансии, отклики, позиции резерва и карточки конкурсов (название, суд). */
@Injectable()
export class VacanciesStore {
  private readonly api = inject(VacanciesApi);
  private readonly reserveApi = inject(ReserveApi);
  private readonly contestApi = inject(ContestApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly vacancies = signal<Vacancy[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly vacanciesLoading = signal(true);

  readonly applications = signal<VacancyApplication[]>([]);
  readonly applicationsLoading = signal(true);

  readonly reserves = signal<Reserve[]>([]);
  readonly contests = signal<ReadonlyMap<number, Contest>>(new Map());

  /** Ключ действия в работе: `v<id вакансии>` или `a<id отклика>`. */
  readonly busy = signal<string | null>(null);

  /** id конкурсов, которые уже запрошены (в том числе в полёте). */
  private readonly requestedContests = new Set<number>();

  constructor() {
    inject(SseService)
      .on('notification')
      .pipe(
        filter((event) => VACANCY_NOTIFICATION_TYPES.has(event.type)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.reload());
  }

  reload(): void {
    this.loadVacancies(this.page());
    this.loadApplications();
    this.loadReserves();
  }

  loadVacancies(page: number): void {
    this.page.set(page);
    this.vacanciesLoading.set(true);
    this.api.available({ page, size: VACANCIES_PAGE_SIZE }).subscribe({
      next: (result) => {
        const vacancies = result.content ?? [];

        this.vacancies.set(vacancies);
        this.total.set(result.totalElements ?? 0);
        this.vacanciesLoading.set(false);
        this.loadContests(vacancies.map((vacancy) => vacancy.contestId));
      },
      error: () => this.vacanciesLoading.set(false),
    });
  }

  reserveOf(contestId: number | undefined): Reserve | undefined {
    return this.reserves().find((reserve) => reserve.contestId === contestId);
  }

  reserveById(reserveId: number | undefined): Reserve | undefined {
    return this.reserves().find((reserve) => reserve.id === reserveId);
  }

  contestOf(contestId: number | undefined): Contest | undefined {
    return contestId === undefined ? undefined : this.contests().get(contestId);
  }

  /** После подачи вакансия уходит из доступных (позиция резерва занята) и появляется в откликах — `done`. */
  apply(vacancyId: number, done?: () => void): void {
    this.run(`v${vacancyId}`, this.api.apply({ vacancyId }), 'vacancies.toast.applied', done);
  }

  confirm(applicationId: number): void {
    this.run(`a${applicationId}`, this.api.confirmApplication(applicationId), 'vacancies.toast.confirmed');
  }

  withdraw(application: VacancyApplication): void {
    if (application.id === undefined) return;

    const message = application.status === 'DRAFT' ? 'vacancies.toast.declined' : 'vacancies.toast.withdrawn';

    this.run(`a${application.id}`, this.api.withdrawApplication(application.id), message);
  }

  private run(key: string, request: Observable<unknown>, successKey: string, done?: () => void): void {
    this.busy.set(key);
    request.subscribe({
      next: () => {
        this.busy.set(null);
        this.notify.success(this.lang.get(successKey));
        this.reload();
        done?.();
      },
      error: () => this.busy.set(null),
    });
  }

  private loadApplications(): void {
    this.applicationsLoading.set(true);
    this.api.myApplications().subscribe({
      next: (applications) => {
        this.applications.set(applications ?? []);
        this.applicationsLoading.set(false);
      },
      error: () => this.applicationsLoading.set(false),
    });
  }

  private loadReserves(): void {
    this.reserveApi.my().subscribe({
      next: (reserves) => {
        this.reserves.set(reserves ?? []);
        this.loadContests((reserves ?? []).map((reserve) => reserve.contestId));
      },
      error: () => undefined,
    });
  }

  /** Карточки конкурсов догружаются по одному разу; ошибка по одному конкурсу не мешает остальным. */
  private loadContests(ids: (number | undefined)[]): void {
    const missing = [...new Set(ids)].filter((id): id is number => id !== undefined && !this.requestedContests.has(id));

    if (!missing.length) return;

    missing.forEach((id) => this.requestedContests.add(id));

    forkJoin(missing.map((id) => this.contestApi.get(id).pipe(catchError(() => of(null))))).subscribe((loaded) => {
      const next = new Map(this.contests());

      loaded.forEach((contest) => contest?.id !== undefined && next.set(contest.id, contest));
      this.contests.set(next);
    });
  }
}
