import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { toLocalDate } from '@shared/lib/dates';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { VACANCIES_PAGE_SIZE, VacanciesStore } from './vacancies.store';
import { VacanciesEmptyComponent } from './vacancies-empty.component';
import { VacancyApplicationCardComponent } from './vacancy-application-card.component';
import { VacancyCardComponent } from './vacancy-card.component';
import {
  hasActiveReserve,
  pendingOffers,
  type Vacancy,
  type VacancyAction,
  vacancyAction,
  type VacancyApplication,
  withdrawKind,
} from './vacancy-rules';

type VacanciesTab = 'available' | 'applications';

/**
 * Вакансии кандидата (`/cabinet/vacancies`, spec 16): доступные вакансии по конкурсам, в резерве которых он состоит,
 * и собственные отклики и предложения из резерва. `?tab=applications` открывает вторую вкладку.
 */
@Component({
  selector: 'app-vacancies-page',
  imports: [
    LangPipe,
    Button,
    Paginator,
    Skeleton,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    PageHeaderComponent,
    VacancyCardComponent,
    VacancyApplicationCardComponent,
    VacanciesEmptyComponent,
  ],
  providers: [VacanciesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vacancies-page.component.html',
})
export default class VacanciesPage {
  protected readonly store = inject(VacanciesStore);
  private readonly confirmation = inject(ConfirmationService);
  private readonly lang = inject(LangService);

  /** Query-параметр `?tab=available|applications`. */
  readonly tab = input<string>();

  protected readonly activeTab = signal<string | number | undefined>('available');
  protected readonly pageSize = VACANCIES_PAGE_SIZE;
  protected readonly skeletonRows = [1, 2];
  protected readonly today = toLocalDate(new Date());

  protected readonly offers = computed(() => pendingOffers(this.store.applications()));
  /** Действующая позиция в резерве: от неё зависит текст пустого списка. */
  protected readonly inReserve = computed(() => hasActiveReserve(this.store.reserves()));

  /** Первая загрузка с неотвеченными предложениями открывает вкладку откликов (один раз). */
  private autoSwitched = false;

  constructor() {
    effect(() => {
      const param = this.tab();

      if (param === 'applications' || param === 'available') {
        untracked(() => this.selectTab(param));
      }
    });

    effect(() => {
      const offers = this.offers();

      if (this.autoSwitched || this.store.applicationsLoading()) return;

      this.autoSwitched = true;

      if (offers > 0 && !this.tab()) untracked(() => this.selectTab('applications'));
    });

    this.store.reload();
  }

  protected actionOf(vacancy: Vacancy): VacancyAction {
    return vacancyAction(vacancy, this.store.applications(), this.today);
  }

  protected contestOfApplication(application: VacancyApplication) {
    return this.store.contestOf(this.store.reserveById(application.reserveId)?.contestId);
  }

  protected vacancyName(application: VacancyApplication): string | undefined {
    return this.store.vacancies().find((vacancy) => vacancy.id === application.vacancyId)?.name;
  }

  protected onPage(state: PaginatorState): void {
    this.store.loadVacancies(Math.floor((state.first ?? 0) / this.pageSize));
  }

  protected askApply(vacancy: Vacancy): void {
    const id = vacancy.id;

    if (id === undefined) return;

    this.ask('apply', { name: vacancy.name ?? '' }, () => this.store.apply(id, () => this.selectTab('applications')));
  }

  protected askConfirm(application: VacancyApplication): void {
    const id = application.id;

    if (id === undefined) return;

    this.ask('confirm', {}, () => this.store.confirm(id));
  }

  protected askWithdraw(application: VacancyApplication): void {
    this.ask(withdrawKind(application), {}, () => this.store.withdraw(application), true);
  }

  private selectTab(tab: VacanciesTab): void {
    this.activeTab.set(tab);
  }

  private ask(kind: string, params: Record<string, string>, accept: () => void, danger = false): void {
    this.confirmation.confirm({
      header: this.lang.get(`vacancies.dialog.${kind}.title`),
      message: this.lang.get(`vacancies.dialog.${kind}.message`, params),
      acceptLabel: this.lang.get(`vacancies.action.${kind}`),
      rejectLabel: this.lang.get('shell.actions.cancel'),
      acceptButtonProps: { severity: danger ? 'danger' : 'primary' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept,
    });
  }
}
