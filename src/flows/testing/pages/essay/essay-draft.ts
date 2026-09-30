import { signal } from '@angular/core';

import { DRAFT_DEBOUNCE_MS, draftKey, type EssayDraft, parseDraft, serializeDraft } from './essay.logic';

/**
 * Черновик ответов на устройстве (`sessionStorage`, ключ — id работы): переживает перезагрузку и обрыв сети,
 * пропадает с закрытием вкладки. Запись — через `DRAFT_DEBOUNCE_MS` после ввода, пишется всегда последний текст
 * (читается в момент записи), `flush()` — немедленно.
 */
export class DraftBackup {
  private key: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private source: (() => readonly string[]) | null = null;

  /** Время последней удачной записи, мс. */
  readonly savedAt = signal<number | null>(null);
  readonly failed = signal(false);

  constructor(
    private readonly storage: Storage | null,
    private readonly delay = DRAFT_DEBOUNCE_MS,
  ) {}

  /** Привязывает к работе и возвращает её черновик, если он есть. */
  open(submissionId: number): EssayDraft | null {
    this.cancel();
    this.key = draftKey(submissionId);

    const draft = parseDraft(this.read());

    this.savedAt.set(draft?.savedAt ?? null);
    this.failed.set(false);

    return draft;
  }

  schedule(source: () => readonly string[]): void {
    this.source = source;

    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }

  flush(): void {
    const source = this.source;

    this.cancel();

    if (source) this.write(source());
  }

  write(answers: readonly string[]): void {
    if (this.key === null) return;

    const now = Date.now();

    try {
      if (!this.storage) throw new Error('sessionStorage недоступен');

      this.storage.setItem(this.key, serializeDraft(answers, now));
      this.savedAt.set(now);
      this.failed.set(false);
    } catch {
      this.failed.set(true);
    }
  }

  /** Работа отправлена или сеанс закрыт — черновик больше не нужен. */
  remove(): void {
    this.cancel();

    if (this.key === null) return;

    try {
      this.storage?.removeItem(this.key);
    } catch {
      // Хранилище недоступно — удалять нечего.
    }

    this.savedAt.set(null);
  }

  private read(): string | null {
    try {
      return this.key === null ? null : (this.storage?.getItem(this.key) ?? null);
    } catch {
      return null;
    }
  }

  private cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.source = null;
  }
}

export function safeSessionStorage(view: Window | null): Storage | null {
  try {
    return view?.sessionStorage ?? null;
  } catch {
    return null;
  }
}
