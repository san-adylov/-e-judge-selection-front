import { Pipe, type PipeTransform } from '@angular/core';

import { parseLocalDate, parseServerDateTime } from './dates';

const DATE = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Bishkek',
});

/** `LocalDate` бэкенда (`yyyy-MM-dd`) → `dd.MM.yyyy`: `{{ contest.startDate | localDate }}`. */
@Pipe({ name: 'localDate' })
export class LocalDatePipe implements PipeTransform {
  transform(value: string | null | undefined, fallback = '—'): string {
    const date = parseLocalDate(value);

    return date ? DATE.format(date) : fallback;
  }
}

/**
 * `LocalDateTime` (время сервера, Asia/Bishkek), `Instant`, `OffsetDateTime` → `dd.MM.yyyy, HH:mm` по Бишкеку:
 * `{{ application.testDate | serverDateTime }}`.
 */
@Pipe({ name: 'serverDateTime' })
export class ServerDateTimePipe implements PipeTransform {
  transform(value: string | null | undefined, fallback = '—'): string {
    const date = parseServerDateTime(value);

    return date ? DATE_TIME.format(date) : fallback;
  }
}
