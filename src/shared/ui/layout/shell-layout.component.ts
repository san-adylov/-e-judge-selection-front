import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';

import type { Area } from '../../auth/areas';
import { SessionService } from '../../auth/session.service';
import { AreaSwitcherComponent } from './area-switcher.component';
import { LangSwitcherComponent } from './lang-switcher.component';
import type { NavSection } from './nav.model';

/**
 * Общий каркас зон: шапка, навигация (сайдбар от 1400 px, ниже — выезжающее меню) и контент.
 * Пункты навигации фильтруются по группам доступа. Слот `[shellActions]` — для колокольчика уведомлений.
 */
@Component({
  selector: 'app-shell-layout',
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Button,
    Drawer,
    LangPipe,
    LangSwitcherComponent,
    AreaSwitcherComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell-layout.component.html',
})
export class ShellLayoutComponent {
  protected readonly session = inject(SessionService);
  protected readonly menuOpen = signal(false);

  readonly area = input.required<Area>();
  /** Ключ i18n названия зоны. */
  readonly title = input.required<string>();
  readonly nav = input<NavSection[]>([]);

  protected readonly visibleNav = computed(() =>
    this.nav()
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.access || this.session.can(item.access)),
      }))
      .filter((section) => section.items.length > 0),
  );

  protected readonly initials = computed(() =>
    (this.session.user()?.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );

  protected logout(): void {
    void this.session.logout();
  }
}
