import type { Schemas } from '@domain/api/api.types';

import {
  buildReserveCards,
  contestIdsOf,
  daysBetween,
  EXPIRY_WARN_DAYS,
  linkedOffer,
  type Reserve,
  reserveActions,
  reserveExpiry,
  type ReserveSources,
  type ReserveStatus,
} from './reserve.logic';

type VacancyApplication = Schemas['VacancyApplicationResponse'];

const TODAY = new Date(2026, 8, 28);

const ALL_STATUSES: ReserveStatus[] = [
  'ACTIVE',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EXCLUDED',
  'APPOINTED',
  'CONFIRMED',
  'NOT_CONFIRMED',
];

function reserve(patch: Partial<Reserve> = {}): Reserve {
  return {
    id: 1,
    applicationId: 10,
    contestId: 100,
    status: 'ACTIVE',
    passed: true,
    expiresAt: '2028-01-01',
    ...patch,
  };
}

function sources(patch: Partial<ReserveSources> = {}): ReserveSources {
  return { reserves: [], contests: new Map(), ratings: [], applications: [], vacancies: [], ...patch };
}

describe('reserveActions', () => {
  it('allows confirm and decline only for APPROVED', () => {
    expect(reserveActions('APPROVED')).toEqual({ confirm: true, decline: true });
  });

  it.each(ALL_STATUSES.filter((status) => status !== 'APPROVED'))('forbids actions for %s', (status) => {
    expect(reserveActions(status)).toEqual({ confirm: false, decline: false });
  });

  it('forbids actions without a status', () => {
    expect(reserveActions(undefined)).toEqual({ confirm: false, decline: false });
  });
});

describe('daysBetween', () => {
  it('counts calendar days ignoring time of day', () => {
    expect(daysBetween(new Date(2026, 8, 28, 23, 59), new Date(2026, 8, 29, 0, 1))).toBe(1);
    expect(daysBetween(TODAY, new Date(2026, 9, 28))).toBe(30);
    expect(daysBetween(TODAY, new Date(2026, 8, 20))).toBe(-8);
  });
});

describe('reserveExpiry', () => {
  it('is plain when the term is far away', () => {
    expect(reserveExpiry(reserve({ expiresAt: '2026-10-29' }), TODAY)).toEqual({ tone: 'plain', daysLeft: 31 });
  });

  it(`highlights the last ${EXPIRY_WARN_DAYS} days`, () => {
    expect(reserveExpiry(reserve({ expiresAt: '2026-10-28' }), TODAY)).toEqual({ tone: 'soon', daysLeft: 30 });
    expect(reserveExpiry(reserve({ expiresAt: '2026-09-29' }), TODAY)).toEqual({ tone: 'soon', daysLeft: 1 });
  });

  it('expires on the expiry date itself, as CandidateReserve.isExpired', () => {
    expect(reserveExpiry(reserve({ expiresAt: '2026-09-28' }), TODAY)).toEqual({ tone: 'expired', daysLeft: 0 });
    expect(reserveExpiry(reserve({ expiresAt: '2026-01-01' }), TODAY)).toEqual({ tone: 'expired', daysLeft: 0 });
  });

  it('trusts the backend expired flag', () => {
    expect(reserveExpiry(reserve({ expiresAt: '2026-12-01', expired: true }), TODAY).tone).toBe('expired');
  });

  it('does not highlight final positions', () => {
    for (const status of ['EXCLUDED', 'APPOINTED', 'CONFIRMED'] as const) {
      expect(reserveExpiry(reserve({ status, expiresAt: '2026-10-01', expired: false }), TODAY).tone).toBe('plain');
      expect(reserveExpiry(reserve({ status, expiresAt: '2026-01-01', expired: true }), TODAY).tone).toBe('plain');
    }
  });

  it('highlights non-final positions that still wait for a decision', () => {
    for (const status of ['SUBMITTED', 'APPROVED', 'NOT_CONFIRMED', 'REJECTED'] as const) {
      expect(reserveExpiry(reserve({ status, expiresAt: '2026-10-01' }), TODAY).tone).toBe('soon');
    }
  });

  it('has no term without a date', () => {
    expect(reserveExpiry(reserve({ expiresAt: undefined }), TODAY)).toEqual({ tone: 'plain', daysLeft: null });
  });
});

describe('linkedOffer', () => {
  const offer: VacancyApplication = { id: 7, reserveId: 1, vacancyId: 3, status: 'DRAFT' };

  it('returns the open application of an engaged position', () => {
    expect(linkedOffer(reserve({ status: 'SUBMITTED' }), [offer])).toBe(offer);
    expect(linkedOffer(reserve({ status: 'APPROVED' }), [{ ...offer, status: 'APPROVED' }])?.id).toBe(7);
  });

  it('skips closed applications and applications of other positions', () => {
    const closed = { ...offer, id: 8, status: 'WITHDRAWN' } as const;
    const other = { ...offer, id: 9, reserveId: 2 };

    expect(linkedOffer(reserve({ status: 'SUBMITTED' }), [closed, other, offer])).toBe(offer);
    expect(linkedOffer(reserve({ status: 'SUBMITTED' }), [closed, other])).toBeNull();
  });

  it('ignores history once the position is back in the reserve', () => {
    expect(linkedOffer(reserve({ status: 'ACTIVE' }), [{ ...offer, status: 'APPROVED' }])).toBeNull();
  });
});

describe('buildReserveCards', () => {
  it('joins contest, rank and vacancy data', () => {
    const [card] = buildReserveCards(
      sources({
        reserves: [reserve({ status: 'SUBMITTED' })],
        contests: new Map([[100, { id: 100, name: 'Конкурс в резерв', type: 'RESERVE' }]]),
        ratings: [
          { applicationId: 11, rank: 1 },
          { applicationId: 10, rank: 4 },
        ],
        applications: [{ id: 7, reserveId: 1, vacancyId: 3, status: 'DRAFT' }],
        vacancies: [{ id: 3, contestId: 100, name: 'Судья районного суда' }],
      }),
      TODAY,
    );

    expect(card).toMatchObject({
      contestName: 'Конкурс в резерв',
      contestType: 'RESERVE',
      rank: 4,
      offerVacancyName: 'Судья районного суда',
      availableVacancies: 0,
      actions: { confirm: false, decline: false },
    });
    expect(card?.offer?.id).toBe(7);
  });

  it('counts vacancies open to an active, passed, unexpired position', () => {
    const vacancies = [
      { id: 3, contestId: 100 },
      { id: 4, contestId: 100 },
      { id: 5, contestId: 200 },
    ];
    const count = (patch: Partial<Reserve>) =>
      buildReserveCards(sources({ reserves: [reserve(patch)], vacancies }), TODAY)[0]?.availableVacancies;

    expect(count({})).toBe(2);
    expect(count({ passed: false })).toBe(0);
    expect(count({ expired: true })).toBe(0);
    expect(count({ status: 'SUBMITTED' })).toBe(0);
  });

  it('falls back to empty details when the extra requests failed', () => {
    const [card] = buildReserveCards(sources({ reserves: [reserve({ status: 'APPROVED' })] }), TODAY);

    expect(card).toMatchObject({
      contestName: null,
      contestType: null,
      rank: null,
      offer: null,
      offerVacancyName: null,
    });
    expect(card?.actions).toEqual({ confirm: true, decline: true });
  });
});

describe('contestIdsOf', () => {
  it('returns unique contest ids', () => {
    expect(
      contestIdsOf([
        reserve(),
        reserve({ id: 2 }),
        reserve({ id: 3, contestId: 200 }),
        reserve({ contestId: undefined }),
      ]),
    ).toEqual([100, 200]);
  });
});
