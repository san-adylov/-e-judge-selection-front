import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';

import { StageTimerComponent } from '@features/stage-timer/stage-timer.component';
import { NotifyService } from '@shared/ui/notify.service';

import { AUTO_SUBMIT_SECONDS, textStats, unansweredNumbers } from './essay.logic';
import { EssayWorkStore } from './essay-work.store';

const TIME = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

/**
 * Экран ответа: тема, поле на каждый подвопрос со счётчиком, таймер, статус черновика и отправка.
 * Обычный текст без форматирования: бэкенд хранит ответы строками (`List<String>`), HTML не ожидает.
 */
@Component({
  selector: 'app-essay-writing',
  imports: [LangPipe, Button, Message, Textarea, StageTimerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './essay-writing.component.html',
  host: { class: 'flex flex-col gap-4' },
})
export class EssayWritingComponent {
  protected readonly store = inject(EssayWorkStore);
  private readonly confirm = inject(ConfirmationService);
  private readonly lang = inject(LangService);
  private readonly notify = inject(NotifyService);

  protected readonly autoSubmitSeconds = AUTO_SUBMIT_SECONDS;
  protected readonly emptyError = signal(false);
  protected readonly pasteBlocked = signal(false);
  protected readonly stats = computed(() => this.store.answers().map((answer) => textStats(answer)));
  protected readonly total = computed(() =>
    this.stats().reduce((sum, item) => ({ words: sum.words + item.words, chars: sum.chars + item.chars }), {
      words: 0,
      chars: 0,
    }),
  );
  protected readonly savedTime = computed(() => {
    const savedAt = this.store.savedAt();

    return savedAt === null ? null : TIME.format(savedAt);
  });

  constructor() {
    // Автоотправка у срока закрывает открытое подтверждение.
    effect(() => {
      if (this.store.phase() !== 'writing') untracked(() => this.confirm.close());
    });
  }

  protected onWarn(threshold: number): void {
    this.notify.warn(this.lang.get('shell.stage.warn-title'), this.lang.get(`shell.stage.warn-${threshold}`));
  }

  protected onInput(index: number, event: Event): void {
    this.emptyError.set(false);
    this.store.setAnswer(index, (event.target as HTMLTextAreaElement).value);
  }

  /** Вставка и перетаскивание текста запрещены правилами (как в v1): работа пишется самостоятельно. */
  protected blockPaste(event: Event): void {
    event.preventDefault();
    this.pasteBlocked.set(true);
  }

  protected onBeforeInput(event: InputEvent): void {
    if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop') this.blockPaste(event);
  }

  protected askSubmit(): void {
    const answers = this.store.answers();
    const empty = unansweredNumbers(answers);

    if (empty.length === answers.length) {
      this.emptyError.set(true);

      return;
    }

    const message = this.lang.get('essay.submit.confirm-message');
    const unanswered = empty.length
      ? ` ${this.lang.get('essay.submit.confirm-unanswered', { numbers: empty.join(', ') })}`
      : '';

    this.confirm.confirm({
      header: this.lang.get('essay.submit.confirm-title'),
      message: message + unanswered,
      icon: 'pi pi-send',
      acceptLabel: this.lang.get('essay.submit.accept'),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.store.submit('manual'),
    });
  }
}
