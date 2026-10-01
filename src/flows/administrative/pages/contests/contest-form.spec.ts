import { FormBuilder } from '@angular/forms';

import {
  contestToForm,
  createContestForm,
  invalidSteps,
  quotasFromContest,
  stepsChanged,
  stepsFromPlan,
  toDetailsRequest,
  toStepRequests,
} from './contest-form';

describe('contest form', () => {
  const fb = new FormBuilder();

  it('contestToForm разбирает даты и окна этапов', () => {
    const value = contestToForm({
      name: 'Конкурс',
      type: 'RESERVE',
      startDate: '2026-10-05',
      documentAcceptanceEndDate: '2026-11-05',
      testingWindow: { start: '2026-11-10T09:00:00', end: '2026-11-10T12:00:00' },
      requiredDocumentTypeIds: [3, 4],
    });

    expect(value.name).toBe('Конкурс');
    expect(value.type).toBe('RESERVE');
    expect(value.startDate?.getDate()).toBe(5);
    expect(value.documentAcceptanceEndDate?.getMonth()).toBe(10);
    expect(value.testingStart).not.toBeNull();
    expect(value.essayStart).toBeNull();
    expect(value.requiredDocumentTypeIds).toEqual([3, 4]);
    expect(value.vacantPlaces).toBeNull();
  });

  it('toDetailsRequest: пустое не отправляется, окна — парами, квоты без нулевых', () => {
    const value = contestToForm({ name: 'К' });

    value.description = '  ';
    value.type = 'SUPREME_COURT';
    value.courtInstanceId = 7;
    value.vacantPlaces = 2;
    value.startDate = new Date(2026, 9, 5);
    value.documentAcceptanceEndDate = new Date(2026, 10, 5);
    value.testingStart = new Date(2026, 10, 10, 9, 0);
    value.testingEnd = new Date(2026, 10, 10, 12, 30);
    value.requiredDocumentTypeIds = [3, 3, 4];

    const body = toDetailsRequest(value, 'Верховный суд', [
      { categoryId: 1, questionCount: 10 },
      { categoryId: 2, questionCount: 0 },
      { categoryId: 3, questionCount: null },
    ]);

    expect(body.description).toBeUndefined();
    expect(body.type).toBe('SUPREME_COURT');
    expect(body.courtInstanceId).toBe(7);
    expect(body.courtInstanceName).toBe('Верховный суд');
    expect(body.startDate).toBe('2026-10-05');
    expect(body.documentAcceptanceEndDate).toBe('2026-11-05');
    expect(body.testingWindow).toEqual({ start: '2026-11-10T09:00:00', end: '2026-11-10T12:30:00' });
    expect(body.essayWindow).toBeUndefined();
    expect(body.requiredDocumentTypeIds).toEqual([3, 4]);
    expect(body.questionCategories).toEqual([{ categoryId: 1, questionCount: 10 }]);
  });

  it('без инстанции имя инстанции не отправляется', () => {
    const value = contestToForm({});

    expect(toDetailsRequest(value, 'Суд', []).courtInstanceName).toBeUndefined();
  });

  it('валидаторы формы: окончание приёма после начала, окно этапа целиком', () => {
    const form = createContestForm(fb);

    form.patchValue({ name: 'К', startDate: new Date(2026, 9, 5), documentAcceptanceEndDate: new Date(2026, 9, 5) });

    expect(form.hasError('acceptanceRange')).toBe(true);

    form.patchValue({ documentAcceptanceEndDate: new Date(2026, 9, 6) });

    expect(form.hasError('acceptanceRange')).toBe(false);

    form.patchValue({ essayStart: new Date(2026, 10, 1, 10) });

    expect(form.hasError('windowIncomplete')).toBe(true);

    form.patchValue({ essayEnd: new Date(2026, 10, 1, 9) });

    expect(form.hasError('windowIncomplete')).toBe(false);
    expect(form.hasError('windowRange')).toBe(true);

    form.patchValue({ essayEnd: new Date(2026, 10, 1, 12) });

    expect(form.valid).toBe(true);
  });

  it('шаги: все шесть по порядку, в запрос — только с датами, изменения по содержимому', () => {
    const steps = stepsFromPlan([
      { id: 1, type: 'TESTING', order: 2, start: '2026-11-10T09:00:00' },
      { id: 2, type: 'OPENING', order: 1, start: '2026-10-01T10:00:00', end: '2026-10-01T11:00:00' },
    ]);

    expect(steps.map((step) => step.type)).toEqual([
      'OPENING',
      'DOCUMENT_ASSESSMENT',
      'TESTING',
      'ESSAY',
      'INTERVIEW',
      'CLOSING',
    ]);
    expect(toStepRequests(steps)).toEqual([
      { type: 'OPENING', start: '2026-10-01T10:00:00', end: '2026-10-01T11:00:00' },
      { type: 'TESTING', start: '2026-11-10T09:00:00', end: undefined },
    ]);

    const edited = steps.map((step) => ({ ...step }));

    expect(stepsChanged(steps, edited)).toBe(false);

    edited[2].end = new Date(2026, 10, 10, 8);

    expect(stepsChanged(steps, edited)).toBe(true);
    expect(invalidSteps(edited)).toEqual(['TESTING']);
  });

  it('квоты: активные категории плюс уже выбранные неактивные', () => {
    const quotas = quotasFromContest({ questionCategories: [{ categoryId: 2, questionCount: 5 }] }, [
      { id: 1, active: true },
      { id: 2, active: false },
      { id: 3, active: false },
    ]);

    expect(quotas).toEqual([
      { categoryId: 1, questionCount: null },
      { categoryId: 2, questionCount: 5 },
    ]);
  });
});
