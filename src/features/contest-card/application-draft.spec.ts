import { buildApplicationDraft } from './application-draft';

describe('buildApplicationDraft', () => {
  it('без профиля — только язык', () => {
    expect(buildApplicationDraft(null, 'KG')).toEqual({ preferredLanguage: 'KG' });
  });

  it('контакты и язык из профиля', () => {
    expect(
      buildApplicationDraft(
        {
          preferredLanguage: 'RU',
          email: ' candidate@mail.kg ',
          phoneNumber: '+996555000111',
          actualAddress: 'Бишкек, ул. Киевская, 1',
          residentialAddress: 'Ош',
        },
        'KG',
      ),
    ).toEqual({
      preferredLanguage: 'RU',
      email: 'candidate@mail.kg',
      homePhone: '+996555000111',
      homeAddress: 'Бишкек, ул. Киевская, 1',
    });
  });

  it('адрес регистрации, если фактический не указан', () => {
    expect(buildApplicationDraft({ actualAddress: '  ', residentialAddress: 'Ош' }, 'RU').homeAddress).toBe('Ош');
  });

  it('не отправляет значения, которые не пройдут валидацию бэкенда', () => {
    const draft = buildApplicationDraft({ email: 'not-an-email', phoneNumber: '1'.repeat(33) }, 'RU');

    expect(draft).toEqual({ preferredLanguage: 'RU' });
    expect('email' in draft).toBe(false);
    expect('homePhone' in draft).toBe(false);
  });
});
