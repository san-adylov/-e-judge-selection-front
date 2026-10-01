import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';

import type { Schemas } from '@domain/api/api.types';
import { SettingsApi } from '@domain/api/settings.api';
import { localized } from '@shared/lib/language';
import { FormFieldComponent } from '@shared/ui/form/form-field.component';
import { NotifyService } from '@shared/ui/notify.service';

type Question = Schemas['AdditionalInfoQuestionResponse'];

/** Вопросы анкеты «дополнительные сведения» (`/additional-info/questions`): текст на двух языках, порядок, активность. */
@Component({
  selector: 'app-info-questions-tab',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    Button,
    Checkbox,
    Dialog,
    InputNumber,
    Skeleton,
    Tag,
    Textarea,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './info-questions-tab.component.html',
})
export class InfoQuestionsTabComponent implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<Question[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly busy = signal<number | null>(null);
  protected readonly editing = signal(false);
  protected readonly selected = signal<Question | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    textRu: ['', [Validators.required, Validators.maxLength(2000)]],
    textKg: ['', Validators.maxLength(2000)],
    sortOrder: [null as number | null],
    active: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  protected text(item: Question): string {
    return localized(item.textRu, item.textKg, this.lang.currentLang());
  }

  protected open(item: Question | null): void {
    this.selected.set(item);
    this.form.reset({
      textRu: item?.textRu ?? '',
      textKg: item?.textKg ?? '',
      sortOrder: item?.sortOrder ?? null,
      active: item?.active ?? true,
    });
    this.editing.set(true);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const id = this.selected()?.id;

    this.saving.set(true);
    this.save(id, this.body()).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.notify.success(this.lang.get('shell.form.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  /** Быстрое включение/выключение — тот же `PUT` с остальными полями без изменений. */
  protected toggle(item: Question): void {
    const id = item.id;

    if (id === undefined) return;

    this.busy.set(id);
    this.api
      .updateAdditionalQuestion(id, {
        textRu: item.textRu ?? '',
        textKg: item.textKg,
        sortOrder: item.sortOrder,
        active: item.active === false,
      })
      .subscribe({
        next: (updated) => {
          this.busy.set(null);
          this.items.update((items) => items.map((row) => (row.id === updated.id ? updated : row)));
        },
        error: () => this.busy.set(null),
      });
  }

  private body(): Schemas['AdditionalInfoQuestionRequest'] {
    const value = this.form.getRawValue();

    return {
      textRu: value.textRu.trim(),
      textKg: value.textKg.trim() || undefined,
      sortOrder: value.sortOrder ?? undefined,
      active: value.active,
    };
  }

  private save(id: number | undefined, body: Schemas['AdditionalInfoQuestionRequest']) {
    return id === undefined ? this.api.createAdditionalQuestion(body) : this.api.updateAdditionalQuestion(id, body);
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .allAdditionalQuestions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set([...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
