import { formatCountdown, secondsLeft, timerLevel, warningToAnnounce } from './stage-timer.logic';

describe('stage timer', () => {
  it('secondsLeft округляет вверх и не уходит в минус', () => {
    expect(secondsLeft(91_000, 1_000)).toBe(90);
    expect(secondsLeft(91_000, 1_400)).toBe(90);
    expect(secondsLeft(91_000, 2_000)).toBe(89);
    expect(secondsLeft(91_000, 90_999)).toBe(1);
    expect(secondsLeft(91_000, 91_000)).toBe(0);
    expect(secondsLeft(91_000, 200_000)).toBe(0);
  });

  it('formatCountdown: мм:сс до часа, ч:мм:сс от часа', () => {
    expect(formatCountdown(7200)).toBe('2:00:00');
    expect(formatCountdown(5400)).toBe('1:30:00');
    expect(formatCountdown(3661)).toBe('1:01:01');
    expect(formatCountdown(3599)).toBe('59:59');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-3)).toBe('00:00');
  });

  it('timerLevel переключается на 5 и 1 минуте', () => {
    expect(timerLevel(301)).toBe('normal');
    expect(timerLevel(300)).toBe('warning');
    expect(timerLevel(61)).toBe('warning');
    expect(timerLevel(60)).toBe('critical');
  });

  it('warningToAnnounce объявляет каждый порог один раз, после возобновления — только самый срочный', () => {
    expect(warningToAnnounce(400, new Set())).toBeNull();
    expect(warningToAnnounce(300, new Set())).toBe(300);
    expect(warningToAnnounce(200, new Set([300]))).toBeNull();
    expect(warningToAnnounce(60, new Set([300]))).toBe(60);
    expect(warningToAnnounce(30, new Set())).toBe(60);
    expect(warningToAnnounce(0, new Set())).toBeNull();
  });
});
