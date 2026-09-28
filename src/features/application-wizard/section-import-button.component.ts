import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';

import { CandidateProfileApi } from '@domain/api/candidate-profile.api';
import { NotifyService } from '@shared/ui/notify.service';

import type { SectionConfig } from './section-config';
import { importResultParams } from './section-mapping';

/**
 * Импорт из госреестра по ПИН кандидата: дипломы (EDUCATION) или недвижимость из кадастра (ASSET).
 * Уже импортированные записи бэкенд пропускает как дубликаты; итог — тостом «найдено / добавлено / пропущено».
 */
@Component({
  selector: 'app-section-import-button',
  imports: [LangPipe, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button
      icon="pi pi-download"
      size="small"
      severity="secondary"
      [outlined]="true"
      [label]="'profile.import.' + action() | lang"
      [loading]="importing()"
      (onClick)="run()"
    />
  `,
})
export class SectionImportButtonComponent {
  private readonly api = inject(CandidateProfileApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly action = input.required<NonNullable<SectionConfig['importAction']>>();
  /** Добавлена хотя бы одна запись — раздел нужно перезагрузить. */
  readonly imported = output<number>();

  protected readonly importing = signal(false);

  protected run(): void {
    const action = this.action();
    const request = action === 'diplomas' ? this.api.importDiplomas() : this.api.importCadastre();

    this.importing.set(true);
    request.subscribe({
      next: (result) => {
        const params = importResultParams(result);
        const title = this.lang.get(`profile.import.${action}`);

        this.importing.set(false);

        if (params['found'] === 0) {
          this.notify.info(title, this.lang.get('profile.import.nothing'));

          return;
        }

        this.notify.success(title, this.lang.get('profile.import.result', params));

        if (params['imported']) this.imported.emit(params['imported']);
      },
      error: () => this.importing.set(false),
    });
  }
}
