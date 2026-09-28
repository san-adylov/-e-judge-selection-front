import { FormBuilder } from '@angular/forms';

import { createPersonalDataForm, fieldError, pastDateValidator } from './personal-data.form';
import {
  emptyPersonalData,
  formToRequest,
  type PersonalDataFormValue,
  type ProfileResponse,
  profileToForm,
  splitFullName,
} from './personal-data.mapping';

const PROFILE: ProfileResponse = {
  id: 7,
  ownerId: 3,
  pin: '12345678901234',
  lastName: 'Асанов',
  firstName: 'Бакыт',
  middleName: 'Маратович',
  birthDate: '1980-05-17',
  gender: 'MALE',
  citizenshipId: 1,
  nationalityId: 2,
  maritalStatus: 'MARRIED',
  phoneNumber: '+996 555 123 456',
  email: 'asanov@example.kg',
  birthPlace: 'г. Бишкек',
  regionId: 10,
  districtId: 20,
  cityId: 30,
  streetId: 40,
  postalCode: '720001',
  residentialAddress: 'ул. Киевская, 1',
  preferredLanguage: 'KG',
  fileId: 99,
  createdAt: '2026-01-01T10:00:00+06:00',
  updatedAt: '2026-01-02T10:00:00+06:00',
};

describe('personal data mapping', () => {
  it('splits the session full name into last, first and middle names', () => {
    expect(splitFullName('Асанов Бакыт Маратович')).toEqual({
      lastName: 'Асанов',
      firstName: 'Бакыт',
      middleName: 'Маратович',
    });
    expect(splitFullName('  Асанов   Бакыт  Марат уулу ')).toEqual({
      lastName: 'Асанов',
      firstName: 'Бакыт',
      middleName: 'Марат уулу',
    });
    expect(splitFullName(null)).toEqual({ lastName: '', firstName: '', middleName: '' });
  });

  it('prefills only the names when there is no profile yet', () => {
    const value = profileToForm(null, 'Асанов Бакыт');

    expect(value).toEqual({ ...emptyPersonalData(), lastName: 'Асанов', firstName: 'Бакыт' });
  });

  it('maps the response to the form: local date → Date, missing strings → empty, missing ids → null', () => {
    const value = profileToForm(PROFILE);

    expect(value.birthDate).toEqual(new Date(1980, 4, 17));
    expect(value.gender).toBe('MALE');
    expect(value.additionalEmail).toBe('');
    expect(value.actualAddress).toBe('');
    expect(value.streetId).toBe(40);
    expect(value.fileId).toBe(99);
    expect(profileToForm({ ...PROFILE, fileId: undefined }).fileId).toBeNull();
  });

  it('round-trips the response into an equal request without pin and service fields', () => {
    const request = formToRequest(profileToForm(PROFILE));
    const { id: _id, ownerId: _owner, pin: _pin, createdAt: _created, updatedAt: _updated, ...expected } = PROFILE;

    expect(request).toEqual(expected);
    expect('pin' in request).toBe(false);
  });

  it('trims strings and drops empty values from the request', () => {
    const value: PersonalDataFormValue = {
      ...emptyPersonalData(),
      lastName: '  Асанов ',
      firstName: 'Бакыт',
      middleName: '   ',
      birthDate: new Date(1990, 0, 5),
      gender: 'FEMALE',
      regionId: 0,
    };

    expect(formToRequest(value)).toEqual({
      lastName: 'Асанов',
      firstName: 'Бакыт',
      birthDate: '1990-01-05',
      gender: 'FEMALE',
      regionId: 0,
    });
  });
});

describe('personal data form', () => {
  const form = () => createPersonalDataForm(new FormBuilder());

  it('requires last name, first name, birth date and gender like ProfileRequest', () => {
    const group = form();

    expect(group.valid).toBe(false);
    group.patchValue({ lastName: 'Асанов', firstName: 'Бакыт', birthDate: new Date(1980, 0, 1), gender: 'MALE' });
    expect(group.valid).toBe(true);
  });

  it('treats whitespace-only names as empty (@NotBlank)', () => {
    const control = form().controls.lastName;

    control.setValue('   ');
    expect(control.hasError('required')).toBe(true);
  });

  it('accepts only past birth dates (@Past)', () => {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const control = form().controls.birthDate;

    control.setValue(today);
    expect(control.hasError('pastDate')).toBe(true);
    control.setValue(new Date(2000, 0, 1));
    expect(pastDateValidator(control)).toBeNull();
  });

  it('checks e-mail, phone format and lengths', () => {
    const group = form();

    group.controls.email.setValue('not-an-email');
    group.controls.phoneNumber.setValue('call me');
    group.controls.postalCode.setValue('1'.repeat(17));

    expect(group.controls.email.hasError('email')).toBe(true);
    expect(group.controls.phoneNumber.hasError('pattern')).toBe(true);
    expect(group.controls.postalCode.hasError('maxlength')).toBe(true);

    group.controls.phoneNumber.setValue('+996 (555) 12-34-56');
    expect(group.controls.phoneNumber.valid).toBe(true);
  });

  it('reports the first error only after the control is touched', () => {
    const control = form().controls.postalCode;

    control.setValue('1'.repeat(17));
    expect(fieldError(control)).toBeNull();

    control.markAsTouched();
    expect(fieldError(control)).toEqual({ key: 'personal.errors.max-length', params: { max: 16 } });
  });
});
