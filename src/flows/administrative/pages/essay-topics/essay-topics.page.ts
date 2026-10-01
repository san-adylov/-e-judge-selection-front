import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';

import type { Schemas } from '@domain/api/api.types';
import { EssayApi } from '@domain/api/essay.api';
import { localized } from '@shared/lib/language';
import { NotifyService } from '@shared/ui/notify.service';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { TopicDialogComponent } from './topic-dialog.component';

type Topic = Schemas['EssayTopicResponse'];

/** Темы эссе (администратор): `GET /essay/topic`, создание и правка, деактивация (`DELETE` — логическая). */
@Component({
  selector: 'app-essay-topics-page',
  imports: [LangPipe, Button, Skeleton, Tag, PageHeaderComponent, TopicDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="staff-essay-topics.title" subtitle="staff-essay-topics.subtitle">
      <p-button icon="pi pi-plus" [label]="'staff-essay-topics.create-action' | lang" (onClick)="open(null)" />
    </app-page-header>

    <div class="flex max-w-5xl flex-col gap-3">
      @if (loading()) {
        @for (row of [1, 2, 3]; track row) {
          <p-skeleton height="6rem" borderRadius="0.75rem" />
        }
      } @else {
        @for (topic of topics(); track topic.id) {
          <article
            class="flex flex-wrap items-start gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 tablet:p-5"
          >
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <p class="m-0 font-medium leading-relaxed whitespace-pre-line break-words">{{ theme(topic) }}</p>
              @if (topic.subQuestions?.length) {
                <ol class="m-0 flex flex-col gap-0.5 pl-5 text-sm text-surface-600">
                  @for (question of sorted(topic); track question.id) {
                    <li class="break-words">{{ questionText(question) }}</li>
                  }
                </ol>
              }
              <span class="text-xs text-surface-500">{{
                'staff-essay-topics.time-limit' | lang: { minutes: topic.timeLimitMinutes ?? 0 }
              }}</span>
            </div>
            <div class="flex items-center gap-2">
              <p-tag
                [severity]="topic.active === false ? 'secondary' : 'success'"
                [value]="(topic.active === false ? 'staff-essay-topics.inactive' : 'staff-essay-topics.active') | lang"
              />
              <p-button
                icon="pi pi-pencil"
                severity="secondary"
                [text]="true"
                [ariaLabel]="'shell.actions.edit' | lang"
                (onClick)="open(topic)"
              />
              @if (topic.active !== false) {
                <p-button
                  icon="pi pi-eye-slash"
                  severity="danger"
                  [text]="true"
                  [ariaLabel]="'staff-essay-topics.deactivate' | lang"
                  [loading]="busy() === topic.id"
                  (onClick)="deactivate(topic)"
                />
              }
            </div>
          </article>
        } @empty {
          <div class="rounded-xl border border-surface-200 bg-surface-0 p-8 text-center text-surface-500">
            {{ 'staff-essay-topics.empty' | lang }}
          </div>
        }
      }
    </div>

    <app-topic-dialog [(visible)]="editing" [topic]="selected()" (saved)="load()" />
  `,
})
export default class EssayTopicsPage implements OnInit {
  private readonly api = inject(EssayApi);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly topics = signal<Topic[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<number | null>(null);
  protected readonly editing = signal(false);
  protected readonly selected = signal<Topic | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .topics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (topics) => {
          this.topics.set(topics);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected theme(topic: Topic): string {
    return localized(topic.themeRu, topic.themeKg, this.lang.currentLang());
  }

  protected questionText(question: Schemas['SubQuestionResponse']): string {
    return localized(question.questionRu, question.questionKg, this.lang.currentLang());
  }

  protected sorted(topic: Topic): Schemas['SubQuestionResponse'][] {
    return [...(topic.subQuestions ?? [])].sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0));
  }

  protected open(topic: Topic | null): void {
    this.selected.set(topic);
    this.editing.set(true);
  }

  protected deactivate(topic: Topic): void {
    const id = topic.id;

    if (id === undefined) return;

    this.confirm.confirm({
      header: this.lang.get('staff-essay-topics.deactivate-title'),
      message: this.lang.get('staff-essay-topics.deactivate-message'),
      icon: 'pi pi-eye-slash',
      acceptLabel: this.lang.get('staff-essay-topics.deactivate'),
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.busy.set(id);
        this.api.removeTopic(id).subscribe({
          next: () => {
            this.busy.set(null);
            this.notify.success(this.lang.get('staff-essay-topics.deactivated'));
            this.load();
          },
          error: () => this.busy.set(null),
        });
      },
    });
  }
}
