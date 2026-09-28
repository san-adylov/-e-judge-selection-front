import { KG_CITIZENSHIP_CODE, sectionConfig, type SectionFieldContext } from './section-config';
import {
  dateRangeInvalid,
  fileIdOf,
  formValueToBody,
  importResultParams,
  recordToFormValue,
  sourceLabelKey,
} from './section-mapping';

const employment = sectionConfig('EMPLOYMENT')!;
const relative = sectionConfig('RELATIVE')!;
const asset = sectionConfig('ASSET')!;

describe('section mapping', () => {
  it('maps a record to form values: dates → Date, checkboxes → boolean, missing → null', () => {
    const value = recordToFormValue(employment.fields, {
      id: 1,
      organizationName: 'Суд',
      startDate: '2020-02-01',
      current: true,
    });

    expect(value['organizationName']).toBe('Суд');
    expect(value['startDate']).toEqual(new Date(2020, 1, 1));
    expect(value['endDate']).toBeNull();
    expect(value['current']).toBe(true);
    expect(value['fileId']).toBeNull();
    expect('id' in value).toBe(false);
  });

  it('builds an empty form for a new record', () => {
    const value = recordToFormValue(employment.fields);

    expect(value['current']).toBe(false);
    expect(value['position']).toBeNull();
  });

  it('builds the request body: trimmed strings, local dates, no empty values, boolean checkboxes', () => {
    const body = formValueToBody(employment.fields, {
      organizationName: '  Верховный суд ',
      department: '   ',
      position: 'Судья',
      employmentTypeId: 4,
      startDate: new Date(2019, 8, 1),
      endDate: null,
      current: false,
      additionalInfo: '',
      fileId: 12,
      unknownField: 'ignored',
    });

    expect(body).toEqual({
      organizationName: 'Верховный суд',
      position: 'Судья',
      employmentTypeId: 4,
      startDate: '2019-09-01',
      current: false,
      fileId: 12,
    });
  });

  it('round-trips a record through the form', () => {
    const record = {
      organizationName: 'Суд',
      position: 'Судья',
      startDate: '2019-09-01',
      endDate: '2021-01-31',
      current: false,
    };

    expect(formValueToBody(employment.fields, recordToFormValue(employment.fields, record))).toEqual(record);
  });

  it('keeps relativeId for an asset of a relative', () => {
    expect(formValueToBody(asset.fields, { relativeId: 5, typeName: 'Квартира' })).toEqual({
      relativeId: 5,
      typeName: 'Квартира',
    });
  });

  it('detects an end date before the start date unless the job is current', () => {
    const start = new Date(2020, 0, 10);
    const end = new Date(2020, 0, 9);

    expect(dateRangeInvalid(employment, { startDate: start, endDate: end })).toBe(true);
    expect(dateRangeInvalid(employment, { startDate: start, endDate: end, current: true })).toBe(false);
    expect(dateRangeInvalid(employment, { startDate: start, endDate: start })).toBe(false);
    expect(dateRangeInvalid(sectionConfig('AWARD')!, { startDate: start, endDate: end })).toBe(false);
  });

  it('labels only imported records with their source', () => {
    expect(sourceLabelKey({ source: 'DIPLOMA_REGISTRY' })).toBe('profile.source.DIPLOMA_REGISTRY');
    expect(sourceLabelKey({ source: 'CADASTRE' })).toBe('profile.source.CADASTRE');
    expect(sourceLabelKey({ source: 'MANUAL' })).toBeNull();
    expect(sourceLabelKey({})).toBeNull();
  });

  it('reads the file id and the import result', () => {
    expect(fileIdOf({ fileId: 3 })).toBe(3);
    expect(fileIdOf({})).toBeNull();
    expect(importResultParams({ found: 3, imported: 1, skippedAsDuplicates: 2 })).toEqual({
      found: 3,
      imported: 1,
      skipped: 2,
    });
    expect(importResultParams({})).toEqual({ found: 0, imported: 0, skipped: 0 });
  });
});

describe('section config: conditional requirements of the backend', () => {
  const context = (code?: string): SectionFieldContext => ({ directoryCode: () => code });
  const field = (config: typeof employment, key: string) => config.fields.find((item) => item.key === key)!;

  it('requires the employment end date unless «current» (EmploymentRequest.isPeriodValid)', () => {
    const endDate = field(employment, 'endDate');

    expect(endDate.requiredWhen?.({ current: false }, context())).toBe(true);
    expect(endDate.requiredWhen?.({ current: true }, context())).toBe(false);
  });

  it('requires the PIN of a relative with Kyrgyz citizenship (RelativeSection.validate)', () => {
    const pin = field(relative, 'pin');

    expect(pin.requiredWhen?.({ citizenshipId: 1 }, context(KG_CITIZENSHIP_CODE))).toBe(true);
    expect(pin.requiredWhen?.({ citizenshipId: 2 }, context('RU'))).toBe(false);
    expect(pin.pattern?.test('12345678901234')).toBe(true);
  });

  it('offers registry imports only for education and assets', () => {
    expect(sectionConfig('EDUCATION')?.importAction).toBe('diplomas');
    expect(asset.importAction).toBe('cadastre');
    expect(employment.importAction).toBeUndefined();
  });
});
