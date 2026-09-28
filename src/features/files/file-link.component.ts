import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';

import { FilesApi } from '@domain/api/files.api';
import { skipErrorToast } from '@shared/api/http-context';
import { saveBlob } from '@shared/lib/download';

/**
 * Ссылка на файл по id: имя из метаданных `GET /v1/file/{id}`, скачивание — `GET /v1/file/{id}/download`.
 * `<app-file-link [fileId]="record.fileId" />`.
 */
@Component({
  selector: 'app-file-link',
  imports: [LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="inline-flex max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-sm text-primary hover:underline disabled:opacity-60"
      [disabled]="downloading()"
      (click)="download()"
    >
      <i
        class="pi"
        [class.pi-file]="!downloading()"
        [class.pi-spin]="downloading()"
        [class.pi-spinner]="downloading()"
      ></i>
      <span class="truncate">{{ label() || ('shell.files.file' | lang) }}</span>
    </button>
  `,
})
export class FileLinkComponent {
  private readonly files = inject(FilesApi);

  readonly fileId = input.required<number>();
  /** Имя, если уже известно; иначе берётся из метаданных. */
  readonly name = input<string | null>(null);

  protected readonly label = signal<string | null>(null);
  protected readonly downloading = signal(false);

  constructor() {
    effect(() => {
      const id = this.fileId();
      const name = this.name();

      untracked(() => {
        this.label.set(name);

        if (!name) {
          this.files.meta(id, skipErrorToast()).subscribe({
            next: (ref) => this.label.set(ref.fileName ?? null),
            error: () => undefined,
          });
        }
      });
    });
  }

  protected download(): void {
    this.downloading.set(true);
    this.files.download(this.fileId()).subscribe({
      next: (response) => {
        this.downloading.set(false);
        saveBlob(response, this.label() ?? `file-${this.fileId()}`);
      },
      error: () => this.downloading.set(false),
    });
  }
}
