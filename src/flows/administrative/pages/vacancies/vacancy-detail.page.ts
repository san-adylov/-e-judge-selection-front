import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { catchError, forkJoin, type Observable, of } from 'rxjs';

import { VacanciesApi } from '@domain/api/vacancies.api';
import { FileLinkComponent } from '@features/files/file-link.component';
import { skipErrorToast } from '@shared/api/http-context';
import { SessionService } from '@shared/auth/session.service';
import { toServerDateTime } from '@shared/lib/dates';
import { LocalDatePipe, ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { VacancyFormDialogComponent } from './vacancy-form-dialog.component';
import {
  freePlaces,
  VACANCIES_URL,
  type Vacancy,
  vacancyActions,
  type VacancyApplication,
  vacancyApplicationActions,
} from './vacancy-rules';

/**
 * Вакансия (`/administrative/vacancies/:id`): карточка, отклики резервистов с голосами, действия по роли —
 * правка и публикация (секретарь), отмена и заседание по кандидатам (председатель), добор из резерва (секретарь),
 * представление на назначение (сунуш) по одобренному отклику.
 */
@Component({
  selector: 'app-staff-vacancy-detail-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    LocalDatePipe,
    ServerDateTimePipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    DatePicker,
    Dialog,
    Message,
    Skeleton,
    StatusTagComponent,
    FileLinkComponent,
    VacancyFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vacancy-detail.page.html',
})
export default class StaffVacancyDetailPage {
  private readonly api = inject(VacanciesApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly baseUrl = VACANCIES_URL;
  protected readonly now = new Date();
  protected readonly vacancy = signal<Vacancy | null>(null);
  protected readonly applications = signal<VacancyApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly busy = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly scheduling = signal(false);
  protected readonly meetingStart = signal<Date | null>(null);

  protected readonly free = computed(() => (this.vacancy() ? freePlaces(this.vacancy()!) : 0));
  protected readonly submittedCount = computed(
    () => this.applications().filter((application) => application.status === 'SUBMITTED').length,
  );
  protected readonly actions = computed(() => {
    const vacancy = this.vacancy();

    return vacancy ? vacancyActions(vacancy, this.session.roles(), this.submittedCount()) : null;
  });
  protected readonly applicationActions = vacancyApplicationActions;

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => this.load(id, true));
    });
  }

  protected publish(): void {
    const id = this.vacancy()?.id;

    if (id !== undefined) this.run('publish', this.api.publish(id), 'staff-vacancies.toast.published');
  }

  protected cancel(): void {
    const id = this.vacancy()?.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('staff-vacancies.cancel.title'),
      message: this.lang.get('staff-vacancies.cancel.message'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.lang.get('staff-vacancies.actions.cancel'),
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.run('cancel', this.api.cancel(id), 'staff-vacancies.toast.cancelled'),
    });
  }

  protected selectFromReserve(): void {
    const id = this.vacancy()?.id;

    if (id === undefined) return;

    this.busy.set('select');
    this.api
      .selectFromReserve(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (selection) => {
          this.busy.set(null);
          this.notify.success(
            this.lang.get('staff-vacancies.toast.selected', {
              selected: selection.selected ?? 0,
              missing: selection.missing ?? 0,
            }),
          );
          this.load(this.id(), false);
        },
        error: () => this.busy.set(null),
      });
  }

  protected scheduleMeeting(): void {
    const id = this.vacancy()?.id;
    const start = this.meetingStart();

    if (id === undefined || !start) return;

    this.busy.set('meeting');
    this.api
      .scheduleMeeting(id, { startDateTime: toServerDateTime(start) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meetingId) => {
          this.busy.set(null);
          this.scheduling.set(false);
          this.notify.success(this.lang.get('staff-meetings.schedule.success'));
          void this.router.navigate(['/administrative/meetings', meetingId]);
        },
        error: () => this.busy.set(null),
      });
  }

  protected generateSunush(application: VacancyApplication): void {
    if (application.id !== undefined) {
      this.runApplication(
        application.id,
        this.api.generateSunush(application.id),
        'staff-vacancies.toast.sunush-generated',
      );
    }
  }

  protected confirmSunush(application: VacancyApplication): void {
    if (application.id !== undefined) {
      this.runApplication(
        application.id,
        this.api.confirmSunush(application.id),
        'staff-vacancies.toast.sunush-confirmed',
      );
    }
  }

  protected onSaved(vacancy: Vacancy): void {
    this.vacancy.set(vacancy);
  }

  private run(key: string, request: Observable<Vacancy>, successKey: string): void {
    this.busy.set(key);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (vacancy) => {
        this.busy.set(null);
        this.vacancy.set(vacancy);
        this.notify.success(this.lang.get(successKey));
      },
      error: () => this.busy.set(null),
    });
  }

  private runApplication(id: number, request: Observable<VacancyApplication>, successKey: string): void {
    this.busy.set(`application-${id}`);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (application) => {
        this.busy.set(null);
        this.applications.update((items) => items.map((item) => (item.id === application.id ? application : item)));
        this.notify.success(this.lang.get(successKey));
      },
      error: () => this.busy.set(null),
    });
  }

  private load(rawId: string, initial: boolean): void {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      this.notFound.set(true);
      this.loading.set(false);

      return;
    }

    if (initial) this.loading.set(true);

    forkJoin({
      vacancy: this.api
        .get(id, initial ? skipErrorToast() : undefined)
        .pipe(catchError(() => of<Vacancy | null>(null))),
      applications: this.api.applicationsByVacancy(id).pipe(catchError(() => of<VacancyApplication[]>([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ vacancy, applications }) => {
        this.vacancy.set(vacancy);
        this.applications.set(applications);
        this.notFound.set(vacancy === null);
        this.loading.set(false);
      });
  }
}
