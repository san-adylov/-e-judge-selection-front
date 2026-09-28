import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

/** Тосты приложения поверх PrimeNG `MessageService`; хост — `<p-toast>` в корневом компоненте. */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly messages = inject(MessageService);

  success(summary: string, detail?: string): void {
    this.messages.add({ severity: 'success', summary, detail });
  }

  info(summary: string, detail?: string): void {
    this.messages.add({ severity: 'info', summary, detail });
  }

  warn(summary: string, detail?: string): void {
    this.messages.add({ severity: 'warn', summary, detail });
  }

  error(summary: string, detail?: string): void {
    this.messages.add({ severity: 'error', summary, detail, life: 6000 });
  }
}
