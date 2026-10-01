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
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { catchError, forkJoin, type Observable, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { AssessmentApi } from '@domain/api/assessment.api';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { ApplicationHistoryComponent } from '@features/application-status/application-history.component';
import { skipErrorToast } from '@shared/api/http-context';
import { SseService } from '@shared/api/sse.service';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { type Application, APPLICATIONS_URL, staffApplicationActions } from './application-rules';
import { ApplicationReassignDialogComponent } from './reassign-dialog.component';
import { ApplicationReturnDialogComponent } from './return-dialog.component';

type History = Schemas['ApplicationStatusHistoryResponse'];
type Summary = Schemas['AssessmentSummaryResponse'];

const CONTACT_FIELDS = [
  { key: 'email', label: 'email' },
  { key: 'homePhone', label: 'home-phone' },
  { key: 'workPhone', label: 'work-phone' },
  { key: 'homeAddress', label: 'home-address' },
  { key: 'contactInfo', label: 'contact-info' },
] as const satisfies readonly { key: keyof Application; label: string }[];

/**
 * Заявка для сотрудников (`/administrative/applications/:id`): данные, история, итог оценки документов и действия
 * по роли — регистрация и возврат (секретарь), смена докладчика (председатель), готовность (докладчик),
 * отмена (администратор). Личное дело кандидата — на отдельном экране.
 */
@Component({
  selector: 'app-staff-application-detail-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    ServerDateTimePipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Message,
    Skeleton,
    ToggleSwitch,
    StatusTagComponent,
    ApplicationHistoryComponent,
    ApplicationReturnDialogComponent,
    ApplicationReassignDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './application-detail.page.html',
})
export default class StaffApplicationDetailPage {
  private readonly api = inject(ContestApplicationApi);
  private readonly assessment = inject(AssessmentApi);
  private readonly names = inject(CandidateNamesStore);
  private readonly session = inject(SessionService);
  private readonly sse = inject(SseService);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly baseUrl = APPLICATIONS_URL;
  protected readonly contactFields = CONTACT_FIELDS;
  protected readonly application = signal<Application | null>(null);
  protected readonly history = signal<History[]>([]);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  protected readonly returning = signal(false);
  protected readonly reassigning = signal(false);

  protected readonly candidateName = computed(() => this.names.name(this.application()?.candidateId)());
  protected readonly actions = computed(() => {
    const application = this.application();
    const user = this.session.user();

    return application && user ? staffApplicationActions(application, { roles: user.roles, userId: user.id }) : null;
  });
  protected readonly canAssess = computed(() => this.session.can('COUNCIL'));
  /** Разделы оценки: сколько уже выставлено докладчиком. */
  protected readonly scoredSections = computed(() => {
    const sections = this.summary()?.sections ?? [];

    return { scored: sections.filter((section) => section.scored).length, total: sections.length };
  });

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => this.load(id, true));
    });

    this.sse
      .on('applicationStatus')
      .pipe(takeUntilDestroyed())
      .subscribe(({ applicationId }) => {
        if (String(applicationId) === this.id()) this.load(this.id(), false);
      });
  }

  protected register(): void {
    const id = this.application()?.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('staff-applications.register.confirm-title'),
      message: this.lang.get('staff-applications.register.confirm-message'),
      icon: 'pi pi-check-square',
      acceptLabel: this.lang.get('staff-applications.actions.register'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.run(this.api.register(id), 'staff-applications.register.success'),
    });
  }

  protected cancel(): void {
    const id = this.application()?.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('staff-applications.cancel.confirm-title'),
      message: this.lang.get('staff-applications.cancel.confirm-message'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.lang.get('staff-applications.actions.cancel'),
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.run(this.api.cancel(id), 'staff-applications.cancel.success'),
    });
  }

  protected setReady(ready: boolean): void {
    const id = this.application()?.id;

    if (id === undefined) return;

    this.run(this.api.setReady(id, { ready }), ready ? 'staff-applications.ready.on' : 'staff-applications.ready.off');
  }

  protected replace(application: Application): void {
    this.application.set(application);
    this.load(this.id(), false);
  }

  private run(request: Observable<Application>, successKey: string): void {
    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (application) => {
        this.busy.set(false);
        this.application.set(application);
        this.notify.success(this.lang.get(successKey));
        this.load(this.id(), false);
      },
      error: () => this.busy.set(false),
    });
  }

  /** `initial` — показать скелетон; перезапрос после действия или события SSE идёт без него. */
  private load(rawId: string, initial: boolean): void {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      this.notFound.set(true);
      this.loading.set(false);

      return;
    }

    if (initial) {
      this.loading.set(true);
      this.application.set(null);
      this.history.set([]);
      this.summary.set(null);
    }

    forkJoin({
      application: this.api.get(id, initial ? skipErrorToast() : undefined),
      history: this.api.history(id).pipe(catchError(() => of<History[]>([]))),
      summary: this.canAssess()
        ? this.assessment.documentSummary(id).pipe(catchError(() => of<Summary | null>(null)))
        : of<Summary | null>(null),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ application, history, summary }) => {
          this.application.set(application);
          this.history.set(history);
          this.summary.set(summary);
          this.notFound.set(false);
          this.loading.set(false);
        },
        error: () => {
          if (initial) this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }
}
