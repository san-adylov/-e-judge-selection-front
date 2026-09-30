/**
 * Таймер этапа (тест и эссе): сервер — источник правды, клиент только отсчитывает от момента,
 * вычисленного по последнему ответу сервера.
 */

/** Пороги предупреждений, секунды: за 5 минут и за 1 минуту. */
export const TIMER_WARNINGS = [300, 60] as const;

export type TimerLevel = 'normal' | 'warning' | 'critical';

/** Целые секунды до `endsAt` (обе отметки — по одним часам); вверх — ноль только по факту истечения. */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** `1:05:09` при часе и больше, иначе `05:09`. */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const mmss = `${pad(minutes)}:${pad(seconds % 60)}`;

  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

export function timerLevel(seconds: number): TimerLevel {
  if (seconds <= TIMER_WARNINGS[1]) return 'critical';
  if (seconds <= TIMER_WARNINGS[0]) return 'warning';

  return 'normal';
}

/**
 * Какое предупреждение объявить сейчас: самый срочный из достигнутых и ещё не объявленных порогов.
 * После истечения времени предупреждения не нужны — сработает завершение.
 */
export function warningToAnnounce(seconds: number, announced: ReadonlySet<number>): number | null {
  if (seconds <= 0) return null;

  const reached = TIMER_WARNINGS.filter((threshold) => seconds <= threshold && !announced.has(threshold));

  return reached.length ? Math.min(...reached) : null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
