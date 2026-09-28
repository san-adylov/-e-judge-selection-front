import { ChangeDetectionStrategy, Component } from '@angular/core';

import { NotificationBellComponent } from '@features/notifications/notification-bell.component';
import type { NavSection } from '@shared/ui/layout/nav.model';
import { ShellLayoutComponent } from '@shared/ui/layout/shell-layout.component';

const NAV: NavSection[] = [
  {
    items: [
      { label: 'shell.nav.profile', icon: 'pi pi-id-card', link: '/cabinet/profile' },
      { label: 'shell.nav.contests', icon: 'pi pi-megaphone', link: '/cabinet/contests' },
      { label: 'shell.nav.applications', icon: 'pi pi-file-edit', link: '/cabinet/applications' },
      { label: 'shell.nav.vacancies', icon: 'pi pi-briefcase', link: '/cabinet/vacancies' },
      { label: 'shell.nav.reserve', icon: 'pi pi-bookmark', link: '/cabinet/reserve' },
      { label: 'shell.nav.results', icon: 'pi pi-chart-bar', link: '/cabinet/results' },
      { label: 'shell.nav.complaints', icon: 'pi pi-comments', link: '/cabinet/complaints' },
      { label: 'shell.nav.judge-confirmation', icon: 'pi pi-verified', link: '/cabinet/judge-confirmation' },
      {
        label: 'shell.nav.judge-applications',
        icon: 'pi pi-sync',
        link: '/cabinet/judge-applications',
        access: 'ACTIVE_JUDGE',
      },
    ],
  },
];

@Component({
  selector: 'app-cabinet-shell',
  imports: [ShellLayoutComponent, NotificationBellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-shell-layout area="cabinet" title="shell.area.cabinet" [nav]="nav">
      <app-notification-bell shellActions link="/cabinet/notifications" />
    </app-shell-layout>
  `,
})
export default class CabinetShellComponent {
  protected readonly nav = NAV;
}
