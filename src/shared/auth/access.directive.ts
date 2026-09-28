import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';

import type { AccessRule } from './access-groups';
import { SessionService } from './session.service';

/**
 * Показывает блок, если у пользователя есть группа доступа:
 * `<button *appAccess="'SECRETARY'">…</button>`, `*appAccess="['CHAIRMAN', 'SECRETARY']; else readonly"`.
 */
@Directive({ selector: '[appAccess]' })
export class AccessDirective {
  private readonly template = inject(TemplateRef);
  private readonly container = inject(ViewContainerRef);
  private readonly session = inject(SessionService);

  readonly appAccess = input.required<AccessRule>();
  readonly appAccessElse = input<TemplateRef<unknown> | null>(null);

  constructor() {
    effect(() => {
      const allowed = this.session.can(this.appAccess());
      const fallback = this.appAccessElse();

      this.container.clear();

      if (allowed) this.container.createEmbeddedView(this.template);
      else if (fallback) this.container.createEmbeddedView(fallback);
    });
  }
}
