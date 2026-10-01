import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';

import { EssayApi } from '@domain/api/essay.api';
import { ESSAY_MAX_SCORE } from '@features/rating/score-breakdown';
import { SessionService } from '@shared/auth/session.service';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { localized } from '@shared/lib/language';
import { NotifyService } from '@shared/ui/notify.service';

import { essayAnswers, isValidEssayScore, myEssayScore, type Submission } from './essay-rules';

/**
 * Чтение эссе и оценка: тема, ответы по подвопросам, оценки других проверяющих и своя — один раз
 * (`PUT /essay/reply/{id}/score`, повтор → 4005). Стрелки ← → листают работы списка.
 */
@Component({
  selector: 'app-essay-reader',
  imports: [FormsModule, LangPipe, ServerDateTimePipe, Button, Dialog, InputNumber, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:keydown)': 'onKeydown($event)' },
  template: `
    <p-dialog
      styleClass="w-full max-w-4xl mx-4"
      [modal]="true"
      [maximizable]="true"
      [header]="'staff-essay.reader.title' | lang"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      @if (submission(); as work) {
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-600">
            <span class="font-medium text-surface-900">{{ work.candidateFullName || '—' }}</span>
            @if (work.registrationNumber) {
              <span>№ {{ work.registrationNumber }}</span>
            }
            @if (work.finishedAt) {
              <span>{{ 'staff-essay.reader.finished-at' | lang }} {{ work.finishedAt | serverDateTime }}</span>
            }
            @if (position(); as pos) {
              <span class="ml-auto tabular-nums">{{ pos.index }} / {{ pos.total }}</span>
            }
          </div>

          <section class="rounded-xl border border-surface-200 bg-surface-50 p-4">
            <h3 class="m-0 text-xs font-medium tracking-wide text-surface-500 uppercase">
              {{ 'staff-essay.reader.theme' | lang }}
            </h3>
            <p class="m-0 mt-2 text-base leading-relaxed font-semibold whitespace-pre-line">{{ theme() }}</p>
          </section>

          @for (item of answers(); track item.number) {
            <section class="flex flex-col gap-2 rounded-xl border border-surface-200 p-4">
              @if (questionText(item); as question) {
                <h3 class="m-0 text-sm font-semibold text-primary">
                  {{ 'staff-essay.reader.question' | lang: { number: item.number } }}: {{ question }}
                </h3>
              }
              <p class="m-0 text-sm leading-relaxed whitespace-pre-line break-words">
                {{ item.answer || ('staff-essay.reader.no-answer' | lang) }}
              </p>
            </section>
          }

          @if (work.scores?.length) {
            <section class="rounded-xl border border-surface-200 p-4">
              <h3 class="m-0 mb-2 text-sm font-semibold">{{ 'staff-essay.reader.scores' | lang }}</h3>
              <ul class="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                @for (score of work.scores; track score.boardMemberId) {
                  <li class="flex justify-between gap-3">
                    <span>{{ score.boardMemberFullName || ('staff-essay.reader.reviewer' | lang) }}</span>
                    <span class="font-medium tabular-nums">{{ score.score }}</span>
                  </li>
                }
              </ul>
              @if (work.averageScore !== undefined && work.averageScore !== null) {
                <p class="m-0 mt-2 text-sm text-surface-600">
                  {{ 'staff-essay.reader.average' | lang: { score: work.averageScore } }}
                </p>
              }
            </section>
          }

          <div class="flex flex-wrap items-center gap-3 border-t border-surface-200 pt-4">
            <div class="flex items-center gap-2">
              <p-button
                icon="pi pi-chevron-left"
                severity="secondary"
                [outlined]="true"
                [ariaLabel]="'staff-essay.reader.prev' | lang"
                [disabled]="!canPrev()"
                (onClick)="navigate.emit(-1)"
              />
              <p-button
                icon="pi pi-chevron-right"
                severity="secondary"
                [outlined]="true"
                [ariaLabel]="'staff-essay.reader.next' | lang"
                [disabled]="!canNext()"
                (onClick)="navigate.emit(1)"
              />
            </div>

            <div class="ml-auto flex flex-wrap items-center gap-2">
              @if (myScore() !== null) {
                <p-message
                  severity="success"
                  icon="pi pi-check"
                  [text]="'staff-essay.reader.scored' | lang: { score: myScore() }"
                />
              } @else {
                <label class="text-sm font-medium" for="essay-score">{{ 'staff-essay.reader.score' | lang }}</label>
                <p-inputnumber
                  inputId="essay-score"
                  styleClass="w-28"
                  inputStyleClass="w-28 text-right"
                  mode="decimal"
                  [min]="0"
                  [max]="max"
                  [step]="0.5"
                  [maxFractionDigits]="2"
                  [showButtons]="true"
                  [useGrouping]="false"
                  [ngModel]="draft()"
                  (ngModelChange)="draft.set($event)"
                />
                <span class="text-sm text-surface-500">/ {{ max }}</span>
                <p-button
                  icon="pi pi-check"
                  [label]="'staff-essay.reader.submit' | lang"
                  [loading]="saving()"
                  [disabled]="!valid()"
                  (onClick)="save()"
                />
              }
            </div>
          </div>
        </div>
      }
    </p-dialog>
  `,
})
export class EssayReaderComponent {
  private readonly api = inject(EssayApi);
  private readonly session = inject(SessionService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly visible = model(false);
  readonly submission = input<Submission | null>(null);
  /** Положение в списке для листания. */
  readonly position = input<{ index: number; total: number } | null>(null);
  /** `-1` — предыдущая работа, `1` — следующая. */
  readonly navigate = output<-1 | 1>();
  readonly scored = output<Submission>();

  protected readonly max = ESSAY_MAX_SCORE;
  protected readonly draft = signal<number | null>(null);
  protected readonly saving = signal(false);

  protected readonly theme = computed(() => {
    const topic = this.submission()?.topic;

    return localized(topic?.themeRu, topic?.themeKg, this.lang.currentLang());
  });
  protected readonly answers = computed(() => {
    const submission = this.submission();

    return submission ? essayAnswers(submission) : [];
  });
  protected readonly myScore = computed(() => {
    const submission = this.submission();

    return submission ? myEssayScore(submission, this.session.user()?.id) : null;
  });
  protected readonly valid = computed(() => isValidEssayScore(this.draft()));
  protected readonly canPrev = computed(() => (this.position()?.index ?? 1) > 1);
  protected readonly canNext = computed(() => {
    const position = this.position();

    return !!position && position.index < position.total;
  });

  constructor() {
    // Новая работа — чистое поле оценки.
    effect(() => {
      this.submission();
      untracked(() => this.draft.set(null));
    });
  }

  protected questionText(item: { questionRu?: string; questionKg?: string }): string {
    return localized(item.questionRu, item.questionKg, this.lang.currentLang());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.visible() || event.target instanceof HTMLInputElement) return;

    if (event.key === 'ArrowLeft' && this.canPrev()) this.navigate.emit(-1);
    if (event.key === 'ArrowRight' && this.canNext()) this.navigate.emit(1);
  }

  protected save(): void {
    const id = this.submission()?.id;
    const score = this.draft();

    if (id === undefined || !isValidEssayScore(score)) return;

    this.saving.set(true);
    this.api.score(id, { score }).subscribe({
      next: (submission) => {
        this.saving.set(false);
        this.notify.success(this.lang.get('staff-essay.reader.saved'));
        this.scored.emit(submission);
      },
      error: () => this.saving.set(false),
    });
  }
}
