import { FormBuilder } from '@angular/forms';

import {
  contactsEditable,
  createDraftForm,
  draftFormValue,
  isWizardStatus,
  needsDraftUpdate,
  toDraftRequest,
} from './draft-form';

describe('draft form', () => {
  it('maps the application response to form values with empty strings for missing fields', () => {
    expect(draftFormValue({ id: 1, preferredLanguage: 'KG', email: 'a@b.kg', homePhone: '0555' })).toEqual({
      preferredLanguage: 'KG',
      email: 'a@b.kg',
      homePhone: '0555',
      workPhone: '',
      homeAddress: '',
      contactInfo: '',
    });
    expect(draftFormValue(null).preferredLanguage).toBeNull();
  });

  it('builds the request: trims values and drops empty ones', () => {
    expect(
      toDraftRequest({
        preferredLanguage: 'RU',
        email: '  a@b.kg ',
        homePhone: '',
        workPhone: '   ',
        homeAddress: 'Бишкек',
        contactInfo: '',
      }),
    ).toEqual({ preferredLanguage: 'RU', email: 'a@b.kg', homeAddress: 'Бишкек' });
  });

  it('omits the language when it is not chosen', () => {
    expect(toDraftRequest({ preferredLanguage: null, email: '' })).toEqual({});
  });

  it('round-trips response → form → request', () => {
    const application = {
      preferredLanguage: 'KG' as const,
      email: 'x@y.kg',
      homePhone: '1',
      workPhone: '2',
      homeAddress: 'addr',
      contactInfo: 'info',
    };

    expect(toDraftRequest(draftFormValue(application))).toEqual(application);
  });

  it('validates the form with backend limits', () => {
    const form = createDraftForm(new FormBuilder());

    form.patchValue({ email: 'not-an-email' });
    expect(form.controls.email.invalid).toBe(true);

    form.patchValue({ email: 'ok@mail.kg', homePhone: '1'.repeat(33) });
    expect(form.controls.email.valid).toBe(true);
    expect(form.controls.homePhone.invalid).toBe(true);

    form.patchValue({ homePhone: '+996 555 000 000' });
    expect(form.valid).toBe(true);
  });

  it('opens the wizard only for NEW and RETURNED_FOR_CORRECTION, contacts only for NEW', () => {
    expect(isWizardStatus('NEW')).toBe(true);
    expect(isWizardStatus('RETURNED_FOR_CORRECTION')).toBe(true);
    expect(isWizardStatus('PENDING_SECRETARY_REVIEW')).toBe(false);
    expect(isWizardStatus(undefined)).toBe(false);

    expect(contactsEditable('NEW')).toBe(true);
    expect(contactsEditable('RETURNED_FOR_CORRECTION')).toBe(false);
  });

  it('patches the draft only for a dirty NEW application (backend isDraft(), 4013 otherwise)', () => {
    expect(needsDraftUpdate('NEW', true)).toBe(true);
    expect(needsDraftUpdate('NEW', false)).toBe(false);
    // Возвращённая на доработку заявка отправляется повторно без PATCH, даже если форма «грязная».
    expect(needsDraftUpdate('RETURNED_FOR_CORRECTION', true)).toBe(false);
    expect(needsDraftUpdate('PENDING_SECRETARY_REVIEW', true)).toBe(false);
  });
});
