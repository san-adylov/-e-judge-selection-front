import { profileCompleteness } from './profile-completeness';

describe('profileCompleteness', () => {
  it('is loading until the profile and both section counts arrive', () => {
    const summary = profileCompleteness({ profile: undefined, education: 1, employment: undefined });

    expect(summary.loading).toBe(true);
    expect(summary.complete).toBe(false);
    expect(summary.items.map((item) => item.state)).toEqual(['loading', 'done', 'loading']);
  });

  it('marks personal data as missing without a profile (404)', () => {
    const summary = profileCompleteness({ profile: null, education: 0, employment: 0 });

    expect(summary.loading).toBe(false);
    expect(summary.items).toEqual([
      { section: 'PERSONAL_DATA', state: 'missing' },
      { section: 'EDUCATION', state: 'missing' },
      { section: 'EMPLOYMENT', state: 'missing' },
    ]);
  });

  it('requires the personal information file like the backend check (4137)', () => {
    const summary = profileCompleteness({ profile: { id: 1 }, education: 2, employment: 1 });

    expect(summary.items[0]).toEqual({ section: 'PERSONAL_DATA', state: 'no-file' });
    expect(summary.complete).toBe(false);
  });

  it('is complete with personal data + file, one education and one employment record', () => {
    const summary = profileCompleteness({ profile: { id: 1, fileId: 5 }, education: 1, employment: 3 });

    expect(summary.complete).toBe(true);
    expect(summary.items.every((item) => item.state === 'done')).toBe(true);
  });
});
