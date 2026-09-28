/** `LocalDate` бэкенда: `yyyy-MM-dd` без часового пояса. */
export function toLocalDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Разбирает `yyyy-MM-dd` как локальную дату (а не UTC, как `new Date('yyyy-MM-dd')`). */
export function parseLocalDate(value: string | null | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(year, month - 1, day);

  return date.getMonth() === month - 1 ? date : null;
}

/**
 * `LocalDateTime` бэкенда приходит без зоны и означает время сервера (Asia/Bishkek, UTC+6).
 * `Instant` и `OffsetDateTime` — с зоной, их разбирает `new Date()`.
 */
export function parseServerDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;

  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}+06:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}
