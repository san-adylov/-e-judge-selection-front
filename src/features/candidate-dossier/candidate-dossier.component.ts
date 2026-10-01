import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { catchError, forkJoin, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { CandidateProfileApi } from '@domain/api/candidate-profile.api';
import { ProfileSectionsApi } from '@domain/api/profile-sections.api';
import { SettingsApi } from '@domain/api/settings.api';
import { type AnswerRow, answerRows } from '@features/application-draft/answers';
import { ProfileSectionComponent } from '@features/application-wizard/profile-section.component';
import { SECTION_CONFIGS } from '@features/application-wizard/section-config';
import { FileLinkComponent } from '@features/files/file-link.component';
import { PersonalDataViewComponent } from '@features/personal-data/personal-data-view.component';
import { skipErrorToast } from '@shared/api/http-context';
import { localized } from '@shared/lib/language';

type Profile = Schemas['ProfileResponse'];

/**
 * Личное дело кандидата для сотрудника, только чтение: личные данные (`GET /candidate/profile/{userId}`),
 * разделы (`GET /candidate/sections/{SECTION}?userId`) и, если указана заявка, ответы анкеты по ней.
 * Те же компоненты, что в кабинете кандидата, — одно представление данных для обеих зон.
 */
@Component({
  selector: 'app-candidate-dossier',
  imports: [LangPipe, Message, Skeleton, PersonalDataViewComponent, ProfileSectionComponent, FileLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    <section class="rounded-xl border border-surface-200 bg-surface-0">
      <header class="border-b border-surface-100 px-4 py-3 tablet:px-5">
        <h2 class="m-0 text-lg font-semibold">{{ 'profile.section.PERSONAL_DATA' | lang }}</h2>
      </header>
      <div class="p-4 tablet:p-5">
        @if (profileLoading()) {
          <div class="grid grid-cols-1 gap-3 tablet:grid-cols-2">
            @for (row of [1, 2, 3, 4]; track row) {
              <p-skeleton height="2.75rem" />
            }
          </div>
        } @else if (profile(); as data) {
          <app-personal-data-view [profile]="data" />
        } @else {
          <p-message severity="info" icon="pi pi-info-circle" [text]="'dossier.no-profile' | lang" />
        }
      </div>
    </section>

    @for (config of sections; track config.section) {
      <app-profile-section [config]="config" [userId]="userId()" [readonly]="true" />
    }

    @if (applicationId() !== undefined) {
      <section class="rounded-xl border border-surface-200 bg-surface-0">
        <header class="border-b border-surface-100 px-4 py-3 tablet:px-5">
          <h2 class="m-0 text-lg font-semibold">{{ 'profile.section.ADDITIONAL_INFO' | lang }}</h2>
        </header>
        <div class="flex flex-col gap-3 p-4 tablet:p-5">
          @if (answersLoading()) {
            <p-skeleton height="5rem" />
            <p-skeleton height="5rem" />
          } @else {
            @for (row of answers(); track row.questionId; let i = $index) {
              <article class="flex flex-col gap-2 rounded-xl border border-surface-200 p-4">
                <div class="flex items-start gap-3">
                  <span
                    class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-800"
                  >
                    {{ i + 1 }}
                  </span>
                  <p class="m-0 min-w-0 flex-1 font-medium">{{ questionText(row) }}</p>
                </div>
                <p class="m-0 text-sm whitespace-pre-line text-surface-700">
                  {{ row.answer?.answer || ('dossier.no-answer' | lang) }}
                </p>
                @if (row.answer?.fileId; as fileId) {
                  <app-file-link [fileId]="fileId" />
                }
              </article>
            } @empty {
              <p class="m-0 text-center text-surface-500">{{ 'dossier.no-questions' | lang }}</p>
            }
          }
        </div>
      </section>
    }
  `,
})
export class CandidateDossierComponent {
  private readonly profiles = inject(CandidateProfileApi);
  private readonly sectionsApi = inject(ProfileSectionsApi);
  private readonly settings = inject(SettingsApi);
  private readonly lang = inject(LangService);

  readonly userId = input.required<number>();
  /** Заявка на конкурс — для ответов анкеты, привязанных к ней. */
  readonly applicationId = input<number | undefined>(undefined);

  protected readonly sections = SECTION_CONFIGS;
  protected readonly profile = signal<Profile | null>(null);
  protected readonly profileLoading = signal(true);
  protected readonly answers = signal<AnswerRow[]>([]);
  protected readonly answersLoading = signal(false);

  constructor() {
    effect(() => {
      const userId = this.userId();
      const applicationId = this.applicationId();

      untracked(() => {
        this.loadProfile(userId);
        if (applicationId !== undefined) this.loadAnswers(userId, applicationId);
      });
    });
  }

  protected questionText(row: AnswerRow): string {
    return localized(row.question.textRu, row.question.textKg, this.lang.currentLang());
  }

  private loadProfile(userId: number): void {
    this.profileLoading.set(true);
    this.profiles.ofUser(userId, skipErrorToast()).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.profileLoading.set(false);
      },
      error: () => {
        this.profile.set(null);
        this.profileLoading.set(false);
      },
    });
  }

  private loadAnswers(userId: number, applicationId: number): void {
    this.answersLoading.set(true);
    forkJoin({
      questions: this.settings.additionalQuestions().pipe(catchError(() => of([]))),
      answers: this.sectionsApi.list('ADDITIONAL_INFO', userId).pipe(catchError(() => of([]))),
    }).subscribe(({ questions, answers }) => {
      this.answers.set(answerRows(questions, answers, { applicationId }));
      this.answersLoading.set(false);
    });
  }
}
