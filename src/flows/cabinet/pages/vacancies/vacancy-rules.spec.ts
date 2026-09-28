import {
  acceptanceState,
  applicationActions,
  freePlaces,
  hasActiveReserve,
  isAutoAppointed,
  isOfferExpired,
  pendingOffers,
  type Vacancy,
  vacancyAction,
  type VacancyApplication,
  type VacancyApplicationStatus,
  withdrawKind,
} from './vacancy-rules';

/** 28.09.2026 12:00 по Бишкеку. */
const NOW = new Date('2026-09-28T12:00:00+06:00');
const TODAY = '2026-09-28';

const application = (patch: Partial<VacancyApplication> = {}): VacancyApplication => ({
  id: 1,
  vacancyId: 10,
  status: 'SUBMITTED',
  selectedBySystem: false,
  ...patch,
});

const vacancy = (patch: Partial<Vacancy> = {}): Vacancy => ({
  id: 10,
  contestId: 5,
  name: 'Судья районного суда',
  status: 'PUBLISHED',
  quantity: 3,
  occupiedPlaces: 1,
  startDate: '2026-09-20',
  endDate: '2026-10-05',
  ...patch,
});

describe('applicationActions', () => {
  it('предложение до срока: согласие и отказ', () => {
    const offer = application({ status: 'DRAFT', selectedBySystem: true, responseDeadline: '2026-09-29T12:00:00' });

    expect(applicationActions(offer, NOW)).toEqual({ confirm: true, withdraw: true });
  });

  it('предложение после срока: только отказ, подтвердить нельзя', () => {
    const offer = application({ status: 'DRAFT', selectedBySystem: true, responseDeadline: '2026-09-28T11:59:00' });

    expect(isOfferExpired(offer, NOW)).toBe(true);
    expect(applicationActions(offer, NOW)).toEqual({ confirm: false, withdraw: true });
  });

  it('предложение без срока можно подтвердить', () => {
    expect(applicationActions(application({ status: 'DRAFT' }), NOW).confirm).toBe(true);
  });

  it('поданную заявку можно только отозвать', () => {
    expect(applicationActions(application({ status: 'SUBMITTED' }), NOW)).toEqual({ confirm: false, withdraw: true });
  });

  it.each<VacancyApplicationStatus>(['APPROVED', 'REJECTED', 'WITHDRAWN', 'RESERVE_EXPIRED'])(
    'финальный статус %s без действий',
    (status) => {
      expect(applicationActions(application({ status }), NOW)).toEqual({ confirm: false, withdraw: false });
    },
  );

  it('отказ от предложения и отзыв заявки различаются', () => {
    expect(withdrawKind(application({ status: 'DRAFT' }))).toBe('decline');
    expect(withdrawKind(application({ status: 'SUBMITTED' }))).toBe('withdraw');
  });

  it('счётчик неотвеченных предложений не учитывает просроченные', () => {
    const list = [
      application({ id: 1, status: 'DRAFT', responseDeadline: '2026-09-29T10:00:00' }),
      application({ id: 2, status: 'DRAFT', responseDeadline: '2026-09-27T10:00:00' }),
      application({ id: 3, status: 'SUBMITTED' }),
    ];

    expect(pendingOffers(list, NOW)).toBe(1);
  });

  it('автоматическое назначение — отбор системой без срока отклика', () => {
    expect(isAutoAppointed(application({ selectedBySystem: true, status: 'SUBMITTED' }))).toBe(true);
    expect(
      isAutoAppointed(
        application({ selectedBySystem: true, status: 'SUBMITTED', responseDeadline: '2026-09-29T10:00:00' }),
      ),
    ).toBe(false);
    expect(isAutoAppointed(application({ selectedBySystem: false }))).toBe(false);
  });
});

describe('acceptanceState', () => {
  it('опубликована и в пределах дат — приём открыт (границы включительно)', () => {
    expect(acceptanceState(vacancy(), TODAY)).toBe('OPEN');
    expect(acceptanceState(vacancy({ startDate: TODAY, endDate: TODAY }), TODAY)).toBe('OPEN');
  });

  it('до начала и после окончания приёма', () => {
    expect(acceptanceState(vacancy({ startDate: '2026-09-29' }), TODAY)).toBe('NOT_STARTED');
    expect(acceptanceState(vacancy({ endDate: '2026-09-27' }), TODAY)).toBe('ENDED');
  });

  it('не опубликована — приём закрыт', () => {
    expect(acceptanceState(vacancy({ status: 'REVIEW' }), TODAY)).toBe('CLOSED');
  });
});

describe('vacancyAction', () => {
  it('без заявки в срок приёма — можно откликнуться', () => {
    expect(vacancyAction(vacancy(), [], TODAY)).toBe('APPLY');
  });

  it('действующая заявка по вакансии — повторно откликнуться нельзя', () => {
    expect(vacancyAction(vacancy(), [application({ status: 'SUBMITTED' })], TODAY)).toBe('APPLIED');
    expect(vacancyAction(vacancy(), [application({ status: 'APPROVED' })], TODAY)).toBe('APPLIED');
  });

  it('предложение по вакансии — ведёт к подтверждению', () => {
    expect(vacancyAction(vacancy(), [application({ status: 'DRAFT' })], TODAY)).toBe('OFFERED');
  });

  it('отозванная заявка не мешает откликнуться снова', () => {
    expect(vacancyAction(vacancy(), [application({ status: 'WITHDRAWN' })], TODAY)).toBe('APPLY');
  });

  it('заявка на другую вакансию не учитывается', () => {
    expect(vacancyAction(vacancy(), [application({ vacancyId: 99 })], TODAY)).toBe('APPLY');
  });

  it('вне срока приёма — без кнопки', () => {
    expect(vacancyAction(vacancy({ endDate: '2026-09-01' }), [], TODAY)).toBe('ENDED');
  });
});

describe('freePlaces и hasActiveReserve', () => {
  it('свободные места не уходят в минус', () => {
    expect(freePlaces(vacancy())).toBe(2);
    expect(freePlaces(vacancy({ quantity: 1, occupiedPlaces: 2 }))).toBe(0);
  });

  it('в резерве — активная или занятая заявкой позиция с действующим сроком', () => {
    expect(hasActiveReserve([{ status: 'ACTIVE', expired: false }])).toBe(true);
    expect(hasActiveReserve([{ status: 'SUBMITTED' }])).toBe(true);
    expect(hasActiveReserve([{ status: 'ACTIVE', expired: true }])).toBe(false);
    expect(hasActiveReserve([{ status: 'EXCLUDED' }])).toBe(false);
    expect(hasActiveReserve([])).toBe(false);
  });
});
