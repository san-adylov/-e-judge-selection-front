import { freePlaces, vacancyActions, vacancyApplicationActions } from './vacancy-rules';

describe('vacancy rules', () => {
  it('секретарь редактирует и публикует, председатель отменяет и назначает голосование', () => {
    expect(vacancyActions({ status: 'READY_TO_PUBLISH' }, ['SECRETARY'], 0)).toEqual({
      edit: true,
      publish: true,
      cancel: false,
      scheduleMeeting: false,
      selectFromReserve: false,
    });
    expect(vacancyActions({ status: 'PUBLISHED' }, ['CHAIRMAN'], 2)).toEqual({
      edit: false,
      publish: false,
      cancel: true,
      scheduleMeeting: true,
      selectFromReserve: false,
    });
    expect(vacancyActions({ status: 'PUBLISHED' }, ['CHAIRMAN'], 0).scheduleMeeting).toBe(false);
    expect(vacancyActions({ status: 'PUBLISHED' }, ['SECRETARY'], 0).selectFromReserve).toBe(true);
    expect(vacancyActions({ status: 'CLOSED' }, ['CHAIRMAN'], 3).cancel).toBe(false);
  });

  it('представление формируется по одобренному отклику и подтверждается после формирования', () => {
    expect(vacancyApplicationActions({ status: 'APPROVED' })).toEqual({ generateSunush: true, confirmSunush: false });
    expect(vacancyApplicationActions({ status: 'APPROVED', sunushFileId: 5 })).toEqual({
      generateSunush: false,
      confirmSunush: true,
    });
    expect(
      vacancyApplicationActions({ status: 'APPROVED', sunushFileId: 5, sunushConfirmed: true }).confirmSunush,
    ).toBe(false);
    expect(vacancyApplicationActions({ status: 'SUBMITTED' }).generateSunush).toBe(false);
  });

  it('freePlaces не уходит в минус', () => {
    expect(freePlaces({ quantity: 3, occupiedPlaces: 1 })).toBe(2);
    expect(freePlaces({ quantity: 1, occupiedPlaces: 2 })).toBe(0);
    expect(freePlaces({})).toBe(0);
  });
});
