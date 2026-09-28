import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Step, StepList, Stepper } from 'primeng/stepper';
import { finalize, map, type Observable, of, switchMap, tap } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { AdditionalAnswersComponent } from '@features/application-draft/additional-answers.component';
import { type AnswerBinding, answerRows, unansweredCount } from '@features/application-draft/answers';
import { DossierStore } from '@features/application-draft/dossier.store';
import { DossierCheckComponent } from '@features/application-draft/dossier-check.component';
import {
  contactsEditable,
  createDraftForm,
  draftFormValue,
  needsDraftUpdate,
  toDraftRequest,
} from '@features/application-draft/draft-form';
import { missingDocumentTypeIds, requiredDocumentRows } from '@features/application-draft/required-documents';
import { RequiredDocumentsComponent } from '@features/application-draft/required-documents.component';
import { WIZARD_STEP } from '@features/application-draft/review-checks';
import { apiErrorOf } from '@shared/api/api-error';
import { NotifyService } from '@shared/ui/notify.service';

import { ContactsStepComponent } from './contacts-step.component';
import { ReviewStepComponent } from './review-step.component';

/** Бэкенд: не заполнены обязательные разделы личного дела. */
const DOSSIER_INCOMPLETE = 4137;

/**
 * Шаги мастера для заявки в статусе NEW или RETURNED_FOR_CORRECTION: контакты, личное дело, анкета, документы,
 * отправка. Состояние личного дела — в `DossierStore` на время жизни мастера.
 */
@Component({
  selector: 'app-application-wizard',
  imports: [
    LangPipe,
    Button,
    Step,
    StepList,
    Stepper,
    AdditionalAnswersComponent,
    DossierCheckComponent,
    RequiredDocumentsComponent,
    ContactsStepComponent,
    ReviewStepComponent,
  ],
  providers: [DossierStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  templateUrl: './application-wizard.component.html',
})
export class ApplicationWizardComponent {
  private readonly applications = inject(ContestApplicationApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly lang = inject(LangService);
  private readonly notify = inject(NotifyService);
  protected readonly dossier = inject(DossierStore);

  readonly application = input.required<Schemas['ApplicationResponse']>();
  readonly contest = input<Schemas['ContestResponse'] | null>(null);
  /** Куда уйти после отправки. */
  readonly doneLink = input.required<string>();

  protected readonly stepKeys = ['contacts', 'dossier', 'answers', 'documents', 'review'] as const;
  protected readonly WIZARD_STEP = WIZARD_STEP;
  protected readonly step = signal<number>(WIZARD_STEP.contacts);
  protected readonly saving = signal(false);
  protected readonly sending = signal(false);
  protected readonly form = createDraftForm(inject(FormBuilder));

  protected readonly contacts = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  private readonly formValid = toSignal(this.form.statusChanges.pipe(map(() => this.form.valid)), {
    initialValue: true,
  });

  private readonly applicationId = computed(() => Number(this.application().id));
  protected readonly binding = computed<AnswerBinding>(() => ({ applicationId: this.applicationId() }));
  protected readonly contactsLocked = computed(() => !contactsEditable(this.application().status));
  protected readonly contactsValid = computed(() => this.contactsLocked() || this.formValid());
  protected readonly missingDocuments = computed(() => {
    const rows = requiredDocumentRows(this.contest()?.requiredDocumentTypeIds, this.dossier.documents());

    return missingDocumentTypeIds(rows).length;
  });
  protected readonly unanswered = computed(() =>
    unansweredCount(answerRows(this.dossier.questions(), this.dossier.answers(), this.binding())),
  );

  constructor() {
    this.dossier.load();

    effect(() => {
      const application = this.application();

      untracked(() => {
        this.form.reset(draftFormValue(application));
        if (contactsEditable(application.status)) this.form.enable();
        else this.form.disable();
      });
    });
  }

  /** Переход по шагам свободный; при уходе с контактов изменения сохраняются. */
  protected goTo(next: number | undefined): void {
    if (next === undefined || next === this.step()) return;

    const leavingContacts = this.step() === WIZARD_STEP.contacts;

    this.step.set(next);
    if (leavingContacts) this.saveContacts().subscribe();
  }

  /** «Далее»: с шага контактов не уходим, пока форма невалидна. */
  protected next(): void {
    if (this.step() === WIZARD_STEP.contacts && !this.contactsValid()) {
      this.form.markAllAsTouched();

      return;
    }

    this.goTo(this.step() + 1);
  }

  protected send(): void {
    const warnings = this.missingDocuments() > 0 || this.unanswered() > 0;

    this.confirm.confirm({
      header: this.lang.get('wizard.send.title'),
      message: this.lang.get(warnings ? 'wizard.send.message-warn' : 'wizard.send.message'),
      acceptLabel: this.lang.get('wizard.review.send'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.submit(),
    });
  }

  private submit(): void {
    const id = this.applicationId();

    this.sending.set(true);
    this.saveContacts()
      .pipe(switchMap(() => this.applications.sendForReview(id)))
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.notify.success(this.lang.get('wizard.send.done'));
          void this.router.navigateByUrl(this.doneLink());
        },
        error: (error: unknown) => {
          this.sending.set(false);

          // Бэкенд нашёл пробел в личном деле — обновляем проверку и показываем шаг 2.
          if (apiErrorOf(error)?.errorCode === DOSSIER_INCOMPLETE) {
            this.dossier.refreshDossier();
            this.step.set(WIZARD_STEP.dossier);
          }
        },
      });
  }

  /** `PATCH` только для черновика и только если форма изменена; невалидная форма не отправляется. */
  private saveContacts(): Observable<unknown> {
    if (!needsDraftUpdate(this.application().status, this.form.dirty)) return of(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return of(null);
    }

    this.saving.set(true);

    return this.applications.update(this.applicationId(), toDraftRequest(this.form.getRawValue())).pipe(
      tap((saved) => this.form.reset(draftFormValue(saved))),
      finalize(() => this.saving.set(false)),
    );
  }
}
