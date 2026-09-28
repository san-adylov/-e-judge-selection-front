import { ChangeDetectionStrategy, Component } from '@angular/core';

import { NotificationBellComponent } from '@features/notifications/notification-bell.component';
import type { NavSection } from '@shared/ui/layout/nav.model';
import { ShellLayoutComponent } from '@shared/ui/layout/shell-layout.component';

const BASE = '/administrative';

/** Одна навигация для всех ролей Совета и администраторов; пункты скрываются по группам доступа. */
const NAV: NavSection[] = [
  {
    items: [{ label: 'shell.nav.dashboard', icon: 'pi pi-th-large', link: `${BASE}/dashboard` }],
  },
  {
    title: 'shell.nav.group-contests',
    items: [
      { label: 'shell.nav.contests', icon: 'pi pi-megaphone', link: `${BASE}/contests` },
      { label: 'shell.nav.applications', icon: 'pi pi-file-edit', link: `${BASE}/applications`, access: 'COUNCIL' },
      {
        label: 'shell.nav.document-assessment',
        icon: 'pi pi-check-square',
        link: `${BASE}/document-assessment`,
        access: 'COUNCIL',
      },
      { label: 'shell.nav.essay-review', icon: 'pi pi-pen-to-square', link: `${BASE}/essay-review`, access: 'BOARD' },
      { label: 'shell.nav.interviews', icon: 'pi pi-users', link: `${BASE}/interviews`, access: 'BOARD' },
      { label: 'shell.nav.meetings', icon: 'pi pi-calendar', link: `${BASE}/meetings` },
      { label: 'shell.nav.decisions', icon: 'pi pi-file-check', link: `${BASE}/decisions` },
      { label: 'shell.nav.reserve', icon: 'pi pi-bookmark', link: `${BASE}/reserve` },
      { label: 'shell.nav.vacancies', icon: 'pi pi-briefcase', link: `${BASE}/vacancies` },
      { label: 'shell.nav.complaints', icon: 'pi pi-comments', link: `${BASE}/complaints` },
      { label: 'shell.nav.judges', icon: 'pi pi-verified', link: `${BASE}/judges` },
    ],
  },
  {
    title: 'shell.nav.group-settings',
    items: [
      { label: 'shell.nav.tests', icon: 'pi pi-list-check', link: `${BASE}/tests` },
      { label: 'shell.nav.essay-topics', icon: 'pi pi-book', link: `${BASE}/essay-topics`, access: 'ADMIN' },
      { label: 'shell.nav.directories', icon: 'pi pi-database', link: `${BASE}/directories`, access: 'ADMIN' },
      { label: 'shell.nav.users', icon: 'pi pi-user-edit', link: `${BASE}/users` },
      { label: 'shell.nav.audit', icon: 'pi pi-history', link: `${BASE}/audit`, access: 'ADMIN' },
    ],
  },
];

@Component({
  selector: 'app-administrative-shell',
  imports: [ShellLayoutComponent, NotificationBellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-shell-layout area="administrative" title="shell.area.administrative" [nav]="nav">
      <app-notification-bell shellActions link="/administrative/notifications" />
    </app-shell-layout>
  `,
})
export default class AdministrativeShellComponent {
  protected readonly nav = NAV;
}
