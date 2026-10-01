import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LangService } from '@reforgium/presentia';

import { SKIP_ERROR_TOAST } from '@shared/api/http-context';

import { ContestRequirementsComponent } from './contest-requirements.component';

describe('ContestRequirementsComponent', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LangService,
          useValue: {
            get: (key: string) => key,
            currentLang: () => 'ru',
            observe: (key: string) => () => key,
            isNamespaceLoaded: () => true,
          },
        },
      ],
    });

    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('выключенную запись справочника (её нет в /all) догружает по id и показывает её название', async () => {
    const fixture = TestBed.createComponent(ContestRequirementsComponent);

    fixture.componentRef.setInput('contest', { id: 5, ageRequirementId: 11, requiredDocumentTypeIds: [21, 22] });
    await fixture.whenStable();

    for (const request of backend.match((item) => item.url.endsWith('/all'))) {
      request.flush(request.request.url.includes('DOCUMENT_TYPE') ? [{ id: 21, nameRu: 'Копия диплома' }] : []);
    }

    await fixture.whenStable();

    const age = backend.expectOne('/v1/directory/AGE_REQUIREMENT/11');
    const document = backend.expectOne('/v1/directory/DOCUMENT_TYPE/22');

    expect(age.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    backend.expectNone('/v1/directory/DOCUMENT_TYPE/21');
    age.flush({ id: 11, nameRu: 'Не моложе 30 лет', active: false });
    document.flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Не моложе 30 лет');
    expect(text).toContain('Копия диплома');
  });
});
