import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangService } from '@reforgium/presentia';
import { SelectButton } from 'primeng/selectbutton';

import type { UiLang } from '../../lib/language';

@Component({
  selector: 'app-lang-switcher',
  imports: [SelectButton, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-selectbutton
      size="small"
      optionLabel="label"
      optionValue="value"
      [allowEmpty]="false"
      [options]="options"
      [ngModel]="lang.currentLang()"
      (ngModelChange)="lang.setLang($event)"
    />
  `,
})
export class LangSwitcherComponent {
  protected readonly lang = inject(LangService);
  protected readonly options: { label: string; value: UiLang }[] = [
    { label: 'Рус', value: 'ru' },
    { label: 'Кыр', value: 'kg' },
  ];
}
