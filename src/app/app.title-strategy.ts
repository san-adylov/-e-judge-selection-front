import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { LangService } from '@reforgium/presentia';

const APP_TITLE = 'Отбор судей';

/** `title` маршрута — ключ i18n (`shell.nav.contests`); перевод обновляется при смене языка. */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly lang = inject(LangService);
  private readonly key = signal<string | null>(null);

  constructor() {
    super();
    effect(() => {
      const key = this.key();

      this.lang.currentLang();
      untracked(() => void this.apply(key));
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot) ?? null);
  }

  private async apply(key: string | null): Promise<void> {
    if (!key?.includes('.')) {
      this.title.setTitle(key ? `${key} · ${APP_TITLE}` : APP_TITLE);

      return;
    }

    const namespace = key.split('.')[0];

    if (!this.lang.isNamespaceLoaded(namespace)) await this.lang.loadNamespace(namespace).catch(() => undefined);

    this.title.setTitle(`${this.lang.get(key)} · ${APP_TITLE}`);
  }
}
