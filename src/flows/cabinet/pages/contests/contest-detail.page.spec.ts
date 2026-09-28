import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import { LangService } from '@reforgium/presentia';
import { ConfirmationService } from 'primeng/api';

import type { Schemas } from '@domain/api/api.types';
import { SKIP_ERROR_TOAST } from '@shared/api/http-context';
import { NotifyService } from '@shared/ui/notify.service';

import ContestDetailPage from './contest-detail.page';

type Card = Schemas['ContestCardResponse'];

const OPEN = { status: 'PUBLISHED' as const, startDate: '2020-01-01', documentAcceptanceEndDate: '2099-12-31' };

describe('ContestDetailPage', () => {
  let backend: HttpTestingController;
  let confirm: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    confirm = { confirm: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
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
        { provide: NotifyService, useValue: { success: vi.fn() } },
        { provide: ConfirmationService, useValue: confirm },
      ],
    });

    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function expectUrl(url: string): TestRequest {
    return backend.expectOne((request) => request.url === url);
  }

  /** Отвечает на запросы страницы; `contest: null` — полная карточка недоступна (403). */
  function respond(options: {
    contest: Schemas['ContestResponse'] | null;
    card?: Card;
    applications?: Schemas['ApplicationResponse'][];
  }): TestRequest {
    expectUrl('/v1/candidate/ban-status').flush({ banned: false, entries: [] });

    const contest = expectUrl('/v1/contest/5');

    if (options.contest) contest.flush(options.contest);
    else contest.flush({ errorCode: 4031, message: 'Нет доступа' }, { status: 403, statusText: 'Forbidden' });

    expectUrl('/v1/contest/steps/5').flush([
      { id: 2, type: 'TESTING', order: 2, start: '2026-11-01T10:00:00' },
      { id: 1, type: 'OPENING', order: 1, start: '2026-09-01T09:00:00' },
    ]);
    expectUrl('/v1/contest/available').flush(page(options.card ? [options.card] : []));
    expectUrl('/v1/contest-application/my').flush(page(options.applications ?? []));

    return contest;
  }

  function page<T>(content: T[]) {
    return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1, last: true };
  }

  async function open(): Promise<ComponentFixture<ContestDetailPage>> {
    const fixture = TestBed.createComponent(ContestDetailPage);

    fixture.componentRef.setInput('id', '5');
    await fixture.whenStable();

    return fixture;
  }

  function text(fixture: ComponentFixture<ContestDetailPage>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(fixture: ComponentFixture<ContestDetailPage>, key: string): HTMLButtonElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((item) =>
      item.textContent?.includes(key),
    );
  }

  it('полная карточка: HTML описания, требования из справочников, план и «Подать заявку»', async () => {
    const fixture = await open();
    const contest = respond({
      contest: {
        id: 5,
        name: 'Конкурс в резерв судей',
        type: 'RESERVE',
        ...OPEN,
        description: '<p>Описание <b>конкурса</b></p><script>alert(1)</script>',
        ageRequirementId: 11,
        requiredDocumentTypeIds: [21],
      },
      card: { id: 5, name: 'Конкурс в резерв судей', type: 'RESERVE', ...OPEN, visibleStatus: 'NO_APPLICATION' },
    });

    expect(contest.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    await fixture.whenStable();

    for (const request of backend.match((item) => item.url.startsWith('/v1/directory/'))) {
      request.flush(
        request.request.url.includes('AGE_REQUIREMENT')
          ? [{ id: 11, nameRu: 'Не моложе 30 лет' }]
          : request.request.url.includes('DOCUMENT_TYPE')
            ? [{ id: 21, nameRu: 'Копия диплома' }]
            : [],
      );
    }

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;

    expect(text(fixture)).toContain('Конкурс в резерв судей');
    expect(root.querySelector('b')?.textContent).toBe('конкурса');
    expect(root.querySelector('script')).toBeNull();
    expect(text(fixture)).toContain('Не моложе 30 лет');
    expect(text(fixture)).toContain('Копия диплома');
    expect(text(fixture)).toMatch(/contests\.detail\.step\.OPENING[\s\S]*contests\.detail\.step\.TESTING/);

    button(fixture, 'contests.action.apply')!.click();

    expect(confirm.confirm).toHaveBeenCalledOnce();
  });

  it('без доступа к полной карточке — данные из списка и пояснение', async () => {
    const fixture = await open();

    respond({ contest: null, card: { id: 5, name: 'Конкурс в Верховный суд', type: 'SUPREME_COURT', ...OPEN } });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Конкурс в Верховный суд');
    expect(text(fixture)).toContain('contests.detail.limited');
    expect(text(fixture)).toContain('contests.detail.step.TESTING');
    expect(button(fixture, 'contests.action.apply')).toBeTruthy();
  });

  it('заявка уже есть — «Моя заявка» ведёт в карточку заявки', async () => {
    const fixture = await open();

    respond({
      contest: null,
      card: { id: 5, name: 'Конкурс', type: 'RESERVE', ...OPEN, visibleStatus: 'DRAFT' },
      applications: [{ id: 77, contestId: 5, status: 'NEW' }],
    });
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    expect(button(fixture, 'contests.action.apply')).toBeUndefined();

    button(fixture, 'contests.action.my-application')!.click();

    expect(router.serializeUrl(navigate.mock.calls[0]?.[0] as UrlTree)).toBe('/cabinet/applications/77');
  });

  it('конкурса нет ни в списке, ни по id — сообщение «не найден»', async () => {
    const fixture = await open();

    respond({ contest: null });
    await fixture.whenStable();

    expect(text(fixture)).toContain('contests.detail.not-found');
  });
});
