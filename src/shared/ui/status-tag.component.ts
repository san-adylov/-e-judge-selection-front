import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LangPipe } from '@reforgium/presentia';
import { Tag } from 'primeng/tag';

/** Группы статусов в словаре `status.*.json`. */
export type StatusKind =
  | 'application'
  | 'visible'
  | 'contest'
  | 'contestType'
  | 'vacancy'
  | 'vacancyApplication'
  | 'reserve'
  | 'complaint'
  | 'complaintType'
  | 'judgeApplication'
  | 'judgeConfirmation'
  | 'meeting';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

const SUCCESS = /^(APPROVED|CONFIRMED|COMPLETED|APPOINTED|APPLY|REGISTERED)$|^APPROVED_/;
const DANGER = /^(REJECTED|CANCELLED|DECLINED|EXCLUDED|TEST_FAILED|RESERVE_EXPIRED|NOT_CONFIRMED)$|^REJECTED_|^NO_SHOW/;
const MUTED = /^(NEW|DRAFT|CREATED|NO_APPLICATION|NOT_APPLY|WITHDRAWN|WITHDRAWN_BY_CANDIDATE|CLOSED)$/;
const WARN = /^RETURNED_FOR_CORRECTION$/;

/** Цвет по значению статуса: одна схема для всех групп. */
export function statusSeverity(value: string): Severity {
  if (WARN.test(value)) return 'warn';
  if (SUCCESS.test(value)) return 'success';
  if (DANGER.test(value)) return 'danger';
  if (MUTED.test(value)) return 'secondary';

  return 'info';
}

/**
 * Метка статуса с переводом `status.<kind>.<VALUE>`: `<app-status-tag kind="application" [value]="app.status" />`.
 * Кандидату показываем то, что пришло с бэкенда (`visibleStatus`, `status`), — фронт статусы не вычисляет.
 */
@Component({
  selector: 'app-status-tag',
  imports: [Tag, LangPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value()) {
      <p-tag [severity]="severity()" [value]="'status.' + kind() + '.' + value() | lang" />
    }
  `,
})
export class StatusTagComponent {
  readonly kind = input.required<StatusKind>();
  readonly value = input<string | null | undefined>(null);

  protected readonly severity = computed(() => statusSeverity(this.value() ?? ''));
}
