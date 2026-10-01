import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';

import type { Schemas } from '@domain/api/api.types';
import { TestsApi } from '@domain/api/tests.api';
import { ServerDateTimePipe } from '@shared/lib/format.pipes';
import { localized } from '@shared/lib/language';

type Summary = Schemas['TestSummaryResponse'];
type Review = Schemas['TestReviewResponse'];

const PAGE_SIZE = 20;

/** Пройденные тесты (администратор): `GET /tests` и разбор теста с ключами (`GET /tests/{id}/review`). */
@Component({
  selector: 'app-tests-tab',
  imports: [RouterLink, LangPipe, ServerDateTimePipe, Button, Dialog, Paginator, Skeleton, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      @if (loading()) {
        @for (row of [1, 2, 3]; track row) {
          <p-skeleton height="3.5rem" borderRadius="0.75rem" />
        }
      } @else {
        @for (item of items(); track item.id) {
          <article class="flex flex-wrap items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4">
            <div class="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <a
                class="font-medium text-primary no-underline hover:underline"
                [routerLink]="['/administrative/applications', item.applicationId]"
              >
                {{ 'staff-tests.tests.application' | lang }} #{{ item.applicationId }}
              </a>
              <span class="text-surface-500"
                >{{ item.startedAt | serverDateTime }} — {{ item.finishedAt | serverDateTime }}</span
              >
            </div>
            <span class="tabular-nums">{{ item.correctAnswers ?? 0 }} / {{ item.questionCount ?? 0 }}</span>
            <p-tag
              [severity]="item.passed ? 'success' : 'danger'"
              [value]="(item.passed ? 'quiz.result.passed' : 'quiz.result.failed') | lang"
            />
            <p-button
              size="small"
              icon="pi pi-search"
              severity="secondary"
              [outlined]="true"
              [label]="'staff-tests.tests.review' | lang"
              [loading]="busy() === item.id"
              (onClick)="open(item)"
            />
          </article>
        } @empty {
          <div class="rounded-xl border border-surface-200 bg-surface-0 p-8 text-center text-surface-500">
            {{ 'staff-tests.tests.empty' | lang }}
          </div>
        }
      }
      @if (total() > size) {
        <p-paginator [rows]="size" [first]="page() * size" [totalRecords]="total()" (onPageChange)="onPage($event)" />
      }
    </div>

    <p-dialog
      styleClass="w-full max-w-3xl mx-4"
      [modal]="true"
      [maximizable]="true"
      [header]="'staff-tests.tests.review' | lang"
      [visible]="reviewOpen()"
      (visibleChange)="reviewOpen.set($event)"
    >
      @if (review(); as data) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-sm text-surface-600">
            {{
              'staff-tests.tests.summary' | lang: { correct: data.correctAnswers ?? 0, total: data.questionCount ?? 0 }
            }}
          </p>
          @for (question of data.questions ?? []; track question.number) {
            <section
              class="rounded-lg border p-3"
              [class.border-green-300]="question.correct"
              [class.border-red-300]="!question.correct"
            >
              <p class="m-0 text-sm font-medium">{{ question.number }}. {{ text(question.textRu, question.textKg) }}</p>
              <ul class="m-0 mt-2 flex list-none flex-col gap-0.5 p-0 text-sm">
                @for (option of question.options ?? []; track option.id) {
                  <li class="flex items-start gap-1.5" [class.font-medium]="option.selected">
                    <i
                      class="pi mt-0.5 text-xs"
                      [class.pi-check-circle]="option.correct"
                      [class.text-green-600]="option.correct"
                      [class.pi-circle]="!option.correct"
                      aria-hidden="true"
                    ></i>
                    <span class="break-words">{{ text(option.textRu, option.textKg) }}</span>
                    @if (option.selected) {
                      <span class="text-xs text-surface-500">({{ 'staff-tests.tests.selected' | lang }})</span>
                    }
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </p-dialog>
  `,
})
export class TestsTabComponent implements OnInit {
  private readonly api = inject(TestsApi);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly size = PAGE_SIZE;
  protected readonly items = signal<Summary[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly busy = signal<number | null>(null);
  protected readonly review = signal<Review | null>(null);
  protected readonly reviewOpen = signal(false);

  ngOnInit(): void {
    this.load(0);
  }

  protected onPage(state: PaginatorState): void {
    this.load(Math.floor((state.first ?? 0) / PAGE_SIZE));
  }

  protected text(ru: string | undefined, kg: string | undefined): string {
    return localized(ru, kg, this.lang.currentLang());
  }

  protected open(item: Summary): void {
    if (item.id === undefined) return;

    this.busy.set(item.id);
    this.api.review(item.id).subscribe({
      next: (review) => {
        this.busy.set(null);
        this.review.set(review);
        this.reviewOpen.set(true);
      },
      error: () => this.busy.set(null),
    });
  }

  private load(page: number): void {
    this.loading.set(true);
    this.api
      .list({ page, size: PAGE_SIZE, sort: 'startedAt,desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.items.set(result.content);
          this.total.set(result.totalElements);
          this.page.set(result.page);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
