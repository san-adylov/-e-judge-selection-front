import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, map, type Observable, of, tap, throwError } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { CandidateProfileApi } from '@domain/api/candidate-profile.api';
import { ProfileSectionsApi } from '@domain/api/profile-sections.api';
import { SettingsApi } from '@domain/api/settings.api';
import { skipErrorToast } from '@shared/api/http-context';

import { type AnswerBinding, type AnswerRow, type AnswerValue, toAnswerRequest } from './answers';
import { dossierComplete, dossierItems, type DossierSnapshot } from './completeness';

type Answer = Schemas['AdditionalInfoAnswerResponse'];
type CandidateDocument = Schemas['DocumentResponse'];

/**
 * Данные личного дела, которые нужны мастеру заявки: комплектность, документы, вопросы и ответы.
 * Не синглтон — провайдится страницей мастера (`providers: [DossierStore]`), чтобы шаги делили одно состояние.
 */
@Injectable()
export class DossierStore {
  private readonly profiles = inject(CandidateProfileApi);
  private readonly sections = inject(ProfileSectionsApi);
  private readonly settings = inject(SettingsApi);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly snapshot = signal<DossierSnapshot | null>(null);
  readonly documents = signal<CandidateDocument[]>([]);
  readonly questions = signal<Schemas['AdditionalInfoQuestionResponse'][]>([]);
  readonly answers = signal<Answer[]>([]);

  readonly items = computed(() => {
    const snapshot = this.snapshot();

    return snapshot ? dossierItems(snapshot) : [];
  });

  readonly complete = computed(() => {
    const snapshot = this.snapshot();

    return snapshot !== null && dossierComplete(snapshot);
  });

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      snapshot: this.loadSnapshot(),
      documents: this.sections.list('DOCUMENT'),
      questions: this.settings.additionalQuestions(),
      answers: this.sections.list('ADDITIONAL_INFO'),
    }).subscribe({
      next: ({ snapshot, documents, questions, answers }) => {
        this.snapshot.set(snapshot);
        this.documents.set(documents);
        this.questions.set(questions);
        this.answers.set(answers);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Повторная проверка комплектности — кандидат мог дополнить личное дело в другой вкладке. */
  refreshDossier(): void {
    this.loadSnapshot().subscribe({
      next: (snapshot) => {
        this.snapshot.set(snapshot);
        this.failed.set(false);
      },
      error: () => this.failed.set(true),
    });
  }

  saveAnswer(binding: AnswerBinding, row: AnswerRow, value: AnswerValue): Observable<Answer> {
    const body = toAnswerRequest(binding, row.questionId, value);
    const id = row.answer?.id;
    const request =
      id === undefined
        ? this.sections.create('ADDITIONAL_INFO', body)
        : this.sections.update('ADDITIONAL_INFO', id, body);

    return request.pipe(
      tap((saved) =>
        this.answers.update((list) =>
          id === undefined ? [...list, saved] : list.map((item) => (item.id === id ? saved : item)),
        ),
      ),
    );
  }

  addDocument(body: Schemas['DocumentRequest']): Observable<CandidateDocument> {
    return this.sections
      .create('DOCUMENT', body)
      .pipe(tap((saved) => this.documents.update((list) => [...list, saved])));
  }

  private loadSnapshot(): Observable<DossierSnapshot> {
    return forkJoin({
      // Нет личных данных — 404 (4041): это «не заполнено», а не ошибка; без тоста, прочие ошибки — в `failed`.
      profile: this.profiles
        .my(skipErrorToast())
        .pipe(
          catchError((error: unknown) =>
            error instanceof HttpErrorResponse && error.status === 404 ? of(null) : throwError(() => error),
          ),
        ),
      educationCount: this.sections.list('EDUCATION').pipe(map((list) => list.length)),
      employmentCount: this.sections.list('EMPLOYMENT').pipe(map((list) => list.length)),
    });
  }
}
