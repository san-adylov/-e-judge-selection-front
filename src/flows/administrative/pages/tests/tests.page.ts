import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangService } from '@reforgium/presentia';
import { SelectButton } from 'primeng/selectbutton';

import { SessionService } from '@shared/auth/session.service';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { CodesTabComponent } from './codes-tab.component';
import { QuestionsTabComponent } from './questions-tab.component';
import { TestsTabComponent } from './tests-tab.component';

type Tab = 'questions' | 'tests' | 'codes';

/** Тесты и вопросы (`/administrative/tests`): банк вопросов (сотрудники), пройденные тесты (админ), коды этапов (секретарь). */
@Component({
  selector: 'app-staff-tests-page',
  imports: [
    FormsModule,
    SelectButton,
    PageHeaderComponent,
    CodesTabComponent,
    QuestionsTabComponent,
    TestsTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="staff-tests.title" subtitle="staff-tests.subtitle">
      <p-selectbutton
        optionLabel="label"
        optionValue="value"
        [options]="tabOptions()"
        [allowEmpty]="false"
        [ngModel]="tab()"
        (ngModelChange)="tab.set($event)"
      />
    </app-page-header>

    @switch (tab()) {
      @case ('tests') {
        <app-tests-tab />
      }
      @case ('codes') {
        <app-codes-tab />
      }
      @default {
        <app-questions-tab />
      }
    }
  `,
})
export default class StaffTestsPage {
  private readonly session = inject(SessionService);
  private readonly lang = inject(LangService);

  protected readonly tab = signal<Tab>('questions');

  /** Вкладки по доступу бэкенда: тесты — `@AdminAccess`, коды — `@SecretaryAccess`. */
  protected readonly tabOptions = computed(() => {
    this.lang.currentLang();

    const tabs: Tab[] = ['questions'];

    if (this.session.can('ADMIN')) tabs.push('tests');
    if (this.session.can('SECRETARY')) tabs.push('codes');

    return tabs.map((value) => ({ value, label: this.lang.get(`staff-tests.tabs.${value}`) }));
  });
}
