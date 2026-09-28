import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import type { ProfileSection } from '@domain/api/api.types';
import { ProfileSectionComponent } from '@features/application-wizard/profile-section.component';
import { SECTION_CONFIGS } from '@features/application-wizard/section-config';
import { BanStatusBannerComponent } from '@features/personal-data/ban-status-banner.component';
import { PersonalDataComponent } from '@features/personal-data/personal-data.component';
import type { ProfileResponse } from '@features/personal-data/personal-data.mapping';
import { profileCompleteness } from '@features/personal-data/profile-completeness';
import { ProfileCompletenessComponent } from '@features/personal-data/profile-completeness.component';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

/**
 * Личное дело кандидата: все разделы на одном экране, одна адаптивная версия.
 * Сверху — запрет на участие (если есть) и сводка обязательных разделов (ошибка 4137 при подаче заявки).
 */
@Component({
  selector: 'app-profile-page',
  imports: [
    PageHeaderComponent,
    BanStatusBannerComponent,
    PersonalDataComponent,
    ProfileCompletenessComponent,
    ProfileSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="shell.nav.profile" subtitle="profile.subtitle" />

    <div class="flex max-w-5xl flex-col gap-4">
      <app-ban-status-banner />
      <app-profile-completeness [summary]="completeness()" />

      <app-personal-data id="section-PERSONAL_DATA" class="block scroll-mt-4" (profileChange)="profile.set($event)" />

      @for (config of sections; track config.section) {
        <app-profile-section
          class="block scroll-mt-4"
          [id]="'section-' + config.section"
          [config]="config"
          (loaded)="countLoaded(config.section, $event)"
        />
      }
    </div>
  `,
})
export default class ProfilePage {
  protected readonly sections = SECTION_CONFIGS;
  /** `undefined` — личные данные загружаются, `null` — ещё не заполнены. */
  protected readonly profile = signal<ProfileResponse | null | undefined>(undefined);
  private readonly counts = signal<Partial<Record<ProfileSection, number>>>({});

  protected readonly completeness = computed(() =>
    profileCompleteness({
      profile: this.profile(),
      education: this.counts().EDUCATION,
      employment: this.counts().EMPLOYMENT,
    }),
  );

  protected countLoaded(section: ProfileSection, count: number): void {
    this.counts.update((counts) => ({ ...counts, [section]: count }));
  }
}
