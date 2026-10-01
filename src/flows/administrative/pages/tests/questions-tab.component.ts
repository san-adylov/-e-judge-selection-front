import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import type { Observable } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { QuestionsApi } from '@domain/api/questions.api';
import { AccessDirective } from '@shared/auth/access.directive';
import { saveBlob } from '@shared/lib/download';
import { localized } from '@shared/lib/language';
import { NotifyService } from '@shared/ui/notify.service';

import { QuestionDialogComponent } from './question-dialog.component';

type Question = Schemas['QuestionResponse'];
type Category = Schemas['QuestionCategoryResponse'];

const PAGE_SIZE = 20;

/**
 * Банк вопросов: категория → вопросы (`GET /questions?categoryId`), создание и правка, включение/выключение,
 * удаление; импорт из xlsx и шаблон — администратору (`POST /questions/import`, `GET /questions/import/template`).
 */
@Component({
  selector: 'app-questions-tab',
  imports: [FormsModule, LangPipe, Button, Paginator, Select, Skeleton, Tag, AccessDirective, QuestionDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './questions-tab.component.html',
})
export class QuestionsTabComponent implements OnInit {
  private readonly api = inject(QuestionsApi);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly size = PAGE_SIZE;
  protected readonly categories = signal<Category[]>([]);
  protected readonly categoryId = signal<number | null>(null);
  protected readonly items = signal<Question[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly busy = signal<number | null>(null);
  protected readonly importing = signal(false);
  protected readonly editing = signal(false);
  protected readonly selected = signal<Question | null>(null);

  protected readonly categoryOptions = computed(() => {
    const lang = this.lang.currentLang();

    return this.categories()
      .filter((category) => category.id !== undefined)
      .map((category) => ({
        value: category.id as number,
        label: `${localized(category.nameRu, category.nameKg, lang)}${category.active === false ? ' ·' : ''}`,
      }));
  });

  ngOnInit(): void {
    this.api
      .categories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          if (this.categoryId() === null && categories[0]?.id !== undefined) this.setCategory(categories[0].id);
        },
        error: () => undefined,
      });
  }

  protected setCategory(categoryId: number | null): void {
    this.categoryId.set(categoryId ?? null);
    this.load(0);
  }

  protected onPage(state: PaginatorState): void {
    this.load(Math.floor((state.first ?? 0) / PAGE_SIZE));
  }

  protected text(question: Question): string {
    return localized(question.textRu, question.textKg, this.lang.currentLang());
  }

  protected open(question: Question | null): void {
    this.selected.set(question);
    this.editing.set(true);
  }

  protected onSaved(): void {
    this.load(this.page());
  }

  protected toggle(question: Question): void {
    if (question.id === undefined) return;

    this.run(
      question.id,
      question.active === false ? this.api.activate(question.id) : this.api.deactivate(question.id),
    );
  }

  protected remove(question: Question): void {
    const id = question.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('staff-tests.question.delete-title'),
      message: this.lang.get('staff-tests.question.delete-message'),
      icon: 'pi pi-trash',
      acceptLabel: this.lang.get('shell.actions.delete'),
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.busy.set(id);
        this.api.remove(id).subscribe({
          next: () => {
            this.busy.set(null);
            this.load(this.page());
          },
          error: () => this.busy.set(null),
        });
      },
    });
  }

  protected template(): void {
    this.api.importTemplate().subscribe({ next: (response) => saveBlob(response, 'questions-template.xlsx') });
  }

  protected import(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    input.value = '';

    if (!file) return;

    this.importing.set(true);
    this.api.import(file).subscribe({
      next: (report) => {
        this.importing.set(false);
        this.notify.success(this.lang.get('staff-tests.import.success', { count: report.imported ?? 0 }));
        this.load(this.page());
      },
      error: () => this.importing.set(false),
    });
  }

  private run(id: number, request: Observable<Question>): void {
    this.busy.set(id);
    request.subscribe({
      next: (question) => {
        this.busy.set(null);
        this.items.update((items) => items.map((item) => (item.id === question.id ? question : item)));
      },
      error: () => this.busy.set(null),
    });
  }

  private load(page: number): void {
    const categoryId = this.categoryId();

    this.page.set(page);

    if (categoryId === null) {
      this.items.set([]);
      this.total.set(0);

      return;
    }

    this.loading.set(true);
    this.api
      .byCategory(categoryId, { page, size: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.items.set(result.content);
          this.total.set(result.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
