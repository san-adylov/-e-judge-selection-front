import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import type { Schemas } from '@domain/api/api.types';
import { FilesApi } from '@domain/api/files.api';
import { FileLinkComponent } from '@features/files/file-link.component';
import { skipErrorToast } from '@shared/api/http-context';

/**
 * Файл объявления о конкурсе. Ссылка показывается, только если кандидату доступны метаданные файла:
 * сейчас `FileAccessPolicy` бэкенда отдаёт файлы без владельца (`CONTEST_ANNOUNCEMENT`) только сотрудникам (403, 4316),
 * и мёртвая ссылка с тостом «Нет доступа к файлу» кандидату не нужна — блок скрывается.
 */
@Component({
  selector: 'app-contest-announcement',
  imports: [LangPipe, FileLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `contents`: пустой блок не добавляет отступ `gap` в родительской секции.
  host: { class: 'contents' },
  template: `
    @if (file(); as ref) {
      <div class="flex flex-col gap-1 border-t border-surface-200 pt-3 text-sm">
        <span class="text-surface-500">{{ 'contests.detail.announcement' | lang }}</span>
        <app-file-link [fileId]="fileId()" [name]="ref.fileName || null" />
      </div>
    }
  `,
})
export class ContestAnnouncementComponent {
  private readonly files = inject(FilesApi);

  readonly fileId = input.required<number>();

  protected readonly file = signal<Schemas['StoredFileRef'] | null>(null);

  constructor() {
    effect((onCleanup) => {
      const id = this.fileId();

      untracked(() => {
        this.file.set(null);

        const request = this.files.meta(id, skipErrorToast()).subscribe({
          next: (ref) => this.file.set(ref),
          error: () => this.file.set(null),
        });

        onCleanup(() => request.unsubscribe());
      });
    });
  }
}
