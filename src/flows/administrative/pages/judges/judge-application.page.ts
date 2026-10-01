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
import { Skeleton } from 'primeng/skeleton';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { JudgeApplicationsApi } from '@domain/api/judge-applications.api';
import { CandidateNamesStore } from '@domain/stores/candidate-names.store';
import { CandidateDossierComponent } from '@features/candidate-dossier/candidate-dossier.component';
import { FileLinkComponent } from '@features/files/file-link.component';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { NotifyService } from '@shared/ui/notify.service';
import { StatusTagComponent } from '@shared/ui/status-tag.component';

import { JudgeDialogsComponent } from './judge-dialogs.component';
import { judgeActions, type JudgeApplication, JUDGES_URL } from './judge-rules';
import { JudgeScorePanelComponent } from './judge-score-panel.component';

/**
 * Заявка действующего судьи для сотрудников (`/administrative/judges/applications/:id`): данные, личное дело судьи,
 * баллы и действия по роли — регистрация, докладчик, готовность, заседания трека, приглашение, файлы.
 */
@Component({
  selector: 'app-staff-judge-application-page',
  imports: [
    FormsModule,
    RouterLink,
    LangPipe,
    ServerDateTimePipe,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Skeleton,
    ToggleSwitch,
    StatusTagComponent,
    FileLinkComponent,
    CandidateDossierComponent,
    JudgeDialogsComponent,
    JudgeScorePanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './judge-application.page.html',
})
export default class StaffJudgeApplicationPage {
  private readonly api = inject(JudgeApplicationsApi);
  private readonly names = inject(CandidateNamesStore);
  private readonly session = inject(SessionService);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  /** `:id` из маршрута. */
  readonly id = input.required<string>();

  protected readonly baseUrl = JUDGES_URL;
  protected readonly application = signal<JudgeApplication | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  protected readonly reassigning = signal(false);
  protected readonly scheduling = signal(false);
  protected readonly inviting = signal(false);
  protected readonly attaching = signal(false);

  protected readonly judgeName = computed(() => this.names.name(this.application()?.judgeUserId)());
  protected readonly actions = computed(() => {
    const application = this.application();
    const user = this.session.user();

    return application && user ? judgeActions(application, { roles: user.roles, userId: user.id }) : null;
  });

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => this.load(id));
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
      accept: () => this.run(id, 'register'),
    });
  }

  protected setReady(ready: boolean): void {
    const id = this.application()?.id;

    if (id !== undefined) this.run(id, ready ? 'ready-on' : 'ready-off');
  }

  protected replace(application: JudgeApplication): void {
    this.application.set(application);
  }

  private run(id: number, action: 'register' | 'ready-on' | 'ready-off'): void {
    const request = action === 'register' ? this.api.register(id) : this.api.setReady(id, action === 'ready-on');
    const successKey =
      action === 'register'
        ? 'staff-applications.register.success'
        : action === 'ready-on'
          ? 'staff-applications.ready.on'
          : 'staff-applications.ready.off';

    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (application) => {
        this.busy.set(false);
        this.application.set(application);
        this.notify.success(this.lang.get(successKey));
      },
      error: () => this.busy.set(false),
    });
  }

  private load(rawId: string): void {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      this.notFound.set(true);
      this.loading.set(false);

      return;
    }

    this.loading.set(true);
    this.api
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (application) => {
          this.application.set(application);
          this.notFound.set(false);
          this.loading.set(false);
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }
}
