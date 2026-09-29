import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LangService } from '@reforgium/presentia';
import { type Confirmation, ConfirmationService } from 'primeng/api';

import type { Schemas } from '@domain/api/api.types';
import { SKIP_ERROR_TOAST } from '@shared/api/http-context';
import { NotifyService } from '@shared/ui/notify.service';

import ContestDetailPage from './contest-detail.page';

type Card = Schemas['ContestCardResponse'];

const OPEN = { status: 'PUBLISHED' as const, startDate: '2020-01-01', documentAcceptanceEndDate: '2099-12-31' };
const SERVER_ERROR = { status: 500, statusText: 'Server Error' };

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

  function page<T>(content: T[]) {
    return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1, last: true };
  }

  /**
   * Отвечает на запросы загрузки страницы. `contest`: объект — полная карточка, число — HTTP-статус ошибки
   * (403 по умолчанию: полная карточка недоступна); `'error'` у списков — сбой 500.
   */
  function respond(options: {
    contest?: Schemas['ContestResponse'] | number;
    card?: Card;
    available?: 'error';
    applications?: Schemas['ApplicationResponse'][] | 'error';
    steps?: 'error';
  }): TestRequest {
    const contest = expectUrl('/v1/contest/5');
    const status = typeof options.contest === 'number' ? options.contest : 403;

    if (typeof options.contest === 'object') contest.flush(options.contest);
    else contest.flush({ errorCode: status === 404 ? 40413 : 4031, message: 'Ошибка' }, { status, statusText: '' });

    const steps = expectUrl('/v1/contest/steps/5');

    if (options.steps) steps.flush(null, SERVER_ERROR);
    else
      steps.flush([
        { id: 2, type: 'TESTING', order: 2, start: '2026-11-01T10:00:00' },
        { id: 1, type: 'OPENING', order: 1, start: '2026-09-01T09:00:00' },
      ]);

    const available = expectUrl('/v1/contest/available');

    if (options.available) available.flush(null, SERVER_ERROR);
    else available.flush(page(options.card ? [options.card] : []));

    const my = expectUrl('/v1/contest-application/my');

    if (options.applications === 'error') my.flush(null, SERVER_ERROR);
    else my.flush(page(options.applications ?? []));

    return contest;
  }

  async function open(): Promise<ComponentFixture<ContestDetailPage>> {
    const fixture = TestBed.createComponent(ContestDetailPage);

    fixture.componentRef.setInput('id', '5');
    await fixture.whenStable();
    expectUrl('/v1/candidate/ban-status').flush({ banned: false, entries: [] });

    return fixture;
  }

  /** Справочники требований: `items` — активные записи по коду. */
  function flushDirectories(items: Record<string, { id: number; nameRu: string }[]> = {}): void {
    for (const request of backend.match((item) => item.url.startsWith('/v1/directory/'))) {
      const code = Object.keys(items).find((key) => request.request.url.includes(key));

      request.flush(code ? items[code] : []);
    }
  }

  function text(fixture: ComponentFixture<ContestDetailPage>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(fixture: ComponentFixture<ContestDetailPage>, key: string): HTMLButtonElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((item) =>
      item.textContent?.includes(key),
    );
  }

  function link(fixture: ComponentFixture<ContestDetailPage>, key: string): HTMLAnchorElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).find((item) =>
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
    flushDirectories({
      AGE_REQUIREMENT: [{ id: 11, nameRu: 'Не моложе 30 лет' }],
      DOCUMENT_TYPE: [{ id: 21, nameRu: 'Копия диплома' }],
    });
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

  it('объявление недоступно кандидату (403 на метаданные) — ссылки на файл нет', async () => {
    const fixture = await open();

    respond({ contest: { id: 5, name: 'Конкурс', ...OPEN, announcementFileId: 9 } });
    await fixture.whenStable();
    flushDirectories();

    const meta = expectUrl('/v1/file/9');

    expect(meta.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    meta.flush({ errorCode: 4316, message: 'Нет доступа к файлу' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Конкурс');
    expect(text(fixture)).not.toContain('contests.detail.announcement');
    expect(button(fixture, 'shell.files.file')).toBeUndefined();
  });

  it('объявление доступно — ссылка с именем файла, метаданные запрашиваются один раз', async () => {
    const fixture = await open();

    respond({ contest: { id: 5, name: 'Конкурс', ...OPEN, announcementFileId: 9 } });
    await fixture.whenStable();
    flushDirectories();
    expectUrl('/v1/file/9').flush({ id: 9, fileName: 'Объявление.pdf', category: 'CONTEST_ANNOUNCEMENT' });
    await fixture.whenStable();

    expect(text(fixture)).toContain('contests.detail.announcement');
    expect(button(fixture, 'Объявление.pdf')).toBeTruthy();
  });

  it('без доступа к полной карточке — данные из списка и пояснение', async () => {
    const fixture = await open();

    respond({ card: { id: 5, name: 'Конкурс в Верховный суд', type: 'SUPREME_COURT', ...OPEN } });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Конкурс в Верховный суд');
    expect(text(fixture)).toContain('contests.detail.limited');
    expect(text(fixture)).toContain('contests.detail.step.TESTING');
    expect(button(fixture, 'contests.action.apply')).toBeTruthy();
  });

  it('заявка уже есть — ссылка «Моя заявка» ведёт в карточку заявки', async () => {
    const fixture = await open();

    respond({
      card: { id: 5, name: 'Конкурс', type: 'RESERVE', ...OPEN, visibleStatus: 'DRAFT' },
      applications: [{ id: 77, contestId: 5, status: 'NEW' }],
    });
    await fixture.whenStable();

    expect(button(fixture, 'contests.action.apply')).toBeUndefined();
    expect(button(fixture, 'contests.action.my-application')).toBeUndefined();
    expect(link(fixture, 'contests.action.my-application')?.getAttribute('href')).toBe('/cabinet/applications/77');
  });

  it('сбой /available не теряет свою заявку: вместо «Подать заявку» — «Моя заявка»', async () => {
    const fixture = await open();

    respond({
      contest: { id: 5, name: 'Конкурс', type: 'RESERVE', ...OPEN },
      available: 'error',
      applications: [{ id: 77, contestId: 5, status: 'NEW' }],
    });
    // Конкурса нет в загруженном списке — загрузчик уточняет его тип для правила 4102.
    expectUrl('/v1/contest/5').flush({ id: 5, type: 'RESERVE' });
    await fixture.whenStable();
    flushDirectories();
    await fixture.whenStable();

    expect(button(fixture, 'contests.action.apply')).toBeUndefined();
    expect(link(fixture, 'contests.action.my-application')?.getAttribute('href')).toBe('/cabinet/applications/77');
  });

  it('участие проверить не удалось — подача не предлагается, есть «Повторить»', async () => {
    const fixture = await open();

    respond({ contest: { id: 5, name: 'Конкурс', ...OPEN }, available: 'error', applications: 'error' });
    await fixture.whenStable();
    flushDirectories();
    await fixture.whenStable();

    expect(text(fixture)).toContain('contests.detail.participation-unknown');
    expect(button(fixture, 'contests.action.apply')).toBeUndefined();
    expect(button(fixture, 'contests.retry')).toBeTruthy();
  });

  it('конкурса нет (404) и нет в списке — «не найден» со ссылкой на все конкурсы', async () => {
    const fixture = await open();

    respond({ contest: 404 });
    await fixture.whenStable();

    expect(text(fixture)).toContain('contests.detail.not-found');
    expect(link(fixture, 'contests.detail.back')).toBeTruthy();
    expect(button(fixture, 'contests.detail.back')).toBeUndefined();
  });

  it('сбой загрузки — не «не найден», а ошибка с повтором', async () => {
    const fixture = await open();

    respond({ contest: 500, available: 'error', steps: 'error' });
    await fixture.whenStable();

    expect(text(fixture)).toContain('contests.detail.error');
    expect(text(fixture)).not.toContain('contests.detail.not-found');

    button(fixture, 'contests.retry')!.click();
    respond({ card: { id: 5, name: 'Конкурс', type: 'RESERVE', ...OPEN } });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Конкурс');
    expect(text(fixture)).not.toContain('contests.detail.error');
  });

  it('после отказа 4102 сбой перечитывания не прячет конкурс, подача этого типа закрыта', async () => {
    confirm.confirm.mockImplementation((options: Confirmation): void => {
      options.accept?.();
    });

    const fixture = await open();

    respond({ card: { id: 5, name: 'Конкурс в резерв', type: 'RESERVE', ...OPEN, visibleStatus: 'NO_APPLICATION' } });
    await fixture.whenStable();

    button(fixture, 'contests.action.apply')!.click();
    expectUrl('/v1/candidate/ban-status').flush({ banned: false, entries: [] });
    expectUrl('/v1/candidate/profile').flush({});
    expectUrl('/v1/contest-application/contest/5').flush(
      { errorCode: 4102, message: 'Есть активная заявка' },
      { status: 409, statusText: 'Conflict' },
    );

    respond({ contest: 500, available: 'error', applications: 'error', steps: 'error' });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Конкурс в резерв');
    expect(text(fixture)).not.toContain('contests.detail.error');
    expect(button(fixture, 'contests.action.apply')).toBeUndefined();
    expect(button(fixture, 'contests.action.active-same-type')).toBeTruthy();
  });
});
