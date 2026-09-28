import { FormControl, FormGroup } from '@angular/forms';

import { parseLocalDate, parseServerDateTime, toLocalDate } from './dates';
import { localized, uiLangOf } from './language';
import { dateRangeValidator, pinValidator, stageCodeValidator } from './validators';

describe('dates', () => {
  it('round-trips LocalDate without a time-zone shift', () => {
    const date = parseLocalDate('2026-03-01');

    expect(date?.getDate()).toBe(1);
    expect(toLocalDate(date!)).toBe('2026-03-01');
  });

  it('rejects impossible dates', () => {
    expect(parseLocalDate('2026-02-31')).toBeNull();
    expect(parseLocalDate('')).toBeNull();
  });

  it('reads zone-less LocalDateTime as server time (UTC+6)', () => {
    expect(parseServerDateTime('2026-09-28T10:00:00')?.toISOString()).toBe('2026-09-28T04:00:00.000Z');
    expect(parseServerDateTime('2026-09-28T10:00:00Z')?.toISOString()).toBe('2026-09-28T10:00:00.000Z');
  });
});

describe('validators', () => {
  it('checks PIN and stage code formats', () => {
    expect(pinValidator(new FormControl('12345678901234'))).toBeNull();
    expect(pinValidator(new FormControl('1234'))).not.toBeNull();
    expect(stageCodeValidator(new FormControl('aB3xY9'))).toBeNull();
    expect(stageCodeValidator(new FormControl('aB3-Y9'))).not.toBeNull();
  });

  it('flags an end date before the start date', () => {
    const group = new FormGroup({ start: new FormControl('2026-05-01'), end: new FormControl('2026-04-01') });

    expect(dateRangeValidator('start', 'end')(group)).toEqual({ dateRange: true });
  });
});

describe('language', () => {
  it('maps the backend language and picks localized fields', () => {
    expect(uiLangOf('KG')).toBe('kg');
    expect(uiLangOf('EN')).toBe('ru');
    expect(localized('Жалоба', 'Даттануу', 'kg')).toBe('Даттануу');
    expect(localized('Жалоба', null, 'kg')).toBe('Жалоба');
  });
});
