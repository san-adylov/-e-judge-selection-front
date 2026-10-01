import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangService } from '@reforgium/presentia';
import { SelectButton } from 'primeng/selectbutton';

import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { DirectoryItemsTabComponent } from './directory-items-tab.component';
import { HolidaysTabComponent } from './holidays-tab.component';
import { InfoQuestionsTabComponent } from './info-questions-tab.component';
import { ReferencesTabComponent } from './references-tab.component';
import { ScheduleTabComponent } from './schedule-tab.component';
import { WeightsTabComponent } from './weights-tab.component';

const TABS = ['items', 'holidays', 'references', 'weights', 'schedule', 'questions'] as const;

type Tab = (typeof TABS)[number];

/** Справочники и настройки (`/administrative/directories`, администратор): шесть вкладок — по контроллеру на каждую. */
@Component({
  selector: 'app-directories-page',
  imports: [
    FormsModule,
    SelectButton,
    PageHeaderComponent,
    DirectoryItemsTabComponent,
    HolidaysTabComponent,
    InfoQuestionsTabComponent,
    ReferencesTabComponent,
    ScheduleTabComponent,
    WeightsTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="staff-directories.title" subtitle="staff-directories.subtitle" />

    <p-selectbutton
      class="mb-4 block"
      optionLabel="label"
      optionValue="value"
      [options]="tabOptions()"
      [allowEmpty]="false"
      [ngModel]="tab()"
      (ngModelChange)="tab.set($event)"
    />

    @switch (tab()) {
      @case ('holidays') {
        <app-holidays-tab />
      }
      @case ('references') {
        <app-references-tab />
      }
      @case ('weights') {
        <app-weights-tab />
      }
      @case ('schedule') {
        <app-schedule-tab />
      }
      @case ('questions') {
        <app-info-questions-tab />
      }
      @default {
        <app-directory-items-tab />
      }
    }
  `,
})
export default class DirectoriesPage {
  private readonly lang = inject(LangService);

  protected readonly tab = signal<Tab>('items');
  protected readonly tabOptions = computed(() => {
    this.lang.currentLang();

    return TABS.map((value) => ({ value, label: this.lang.get(`staff-directories.tabs.${value}`) }));
  });
}
