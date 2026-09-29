import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LangService } from '@reforgium/presentia';
import { type Confirmation, ConfirmationService } from 'primeng/api';

import { SKIP_ERROR_TOAST } from '@shared/api/http-context';
import { NotifyService } from '@shared/ui/notify.service';

import { ContestApplyService } from './contest-apply.service';

const BAN = '/v1/candidate/ban-status';
const PROFILE = '/v1/candidate/profile';
const CREATE = '/v1/contest-application/contest/5';

describe('ContestApplyService', () => {
  let service: ContestApplyService;
  let backend: HttpTestingController;
  let router: Router;
  let notify: { success: ReturnType<typeof vi.fn> };
  let confirm: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    notify = { success: vi.fn() };
    // Диалог подтверждения сразу «нажимает» «Да».
    confirm = {
      confirm: vi.fn((options: Confirmation): void => {
        options.accept?.();
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LangService, useValue: { get: (key: string) => key, currentLang: () => 'kg' } },
        { provide: NotifyService, useValue: notify },
        { provide: ConfirmationService, useValue: confirm },
        ContestApplyService,
      ],
    });

    service = TestBed.inject(ContestApplyService);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  function passBanCheck(): void {
    const request = backend.expectOne(BAN);

    expect(request.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    request.flush({ banned: false, entries: [] });
  }

  it('подтверждение → проверка отстранения → черновик с контактами → мастер заявки', () => {
    service.apply({ id: 5, name: 'Конкурс в резерв' });

    expect(confirm.confirm).toHaveBeenCalledOnce();
    expect(service.pending()).toBe(5);

    passBanCheck();

    const profile = backend.expectOne(PROFILE);

    expect(profile.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    profile.flush({ email: 'a@b.kg', phoneNumber: '+996700000000', actualAddress: 'Бишкек' });

    const create = backend.expectOne(CREATE);

    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      preferredLanguage: 'KG',
      email: 'a@b.kg',
      homePhone: '+996700000000',
      homeAddress: 'Бишкек',
    });
    create.flush({ id: 42, contestId: 5, status: 'NEW' });

    expect(notify.success).toHaveBeenCalledWith('contests.apply.created');
    expect(router.navigate).toHaveBeenCalledWith(['/cabinet/applications', 42, 'edit']);
    expect(service.pending()).toBeNull();
  });

  it('отстранённому кандидату черновик не создаётся, показывается ограничение', () => {
    service.apply({ id: 5 });

    backend.expectOne(BAN).flush({ banned: true, bannedUntil: '2027-01-01', entries: [] });
    backend.expectNone(PROFILE);
    backend.expectNone(CREATE);

    expect(service.banned()).toBe(true);
    expect(service.pending()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();

    service.apply({ id: 5 });

    expect(confirm.confirm).toHaveBeenCalledOnce();
  });

  it('без личных данных (404) — подсказка со ссылкой на личное дело вместо запроса', () => {
    service.apply({ id: 5 });
    passBanCheck();
    backend.expectOne(PROFILE).flush({ errorCode: 4041, message: 'Нет' }, { status: 404, statusText: 'Not Found' });
    backend.expectNone(CREATE);

    expect(service.profileHint()).toBe(5);
    expect(service.pending()).toBeNull();
  });

  it('ошибка проверки отстранения не мешает подаче — решает бэкенд', () => {
    service.apply({ id: 5 });
    backend.expectOne(BAN).flush(null, { status: 500, statusText: 'Server Error' });
    backend.expectOne(PROFILE).flush({});
    backend.expectOne(CREATE).flush({ id: 43 });

    expect(router.navigate).toHaveBeenCalledWith(['/cabinet/applications', 43, 'edit']);
  });

  it('отказ 4137 — подсказка про личное дело', () => {
    service.apply({ id: 5 });
    passBanCheck();
    backend.expectOne(PROFILE).flush({});
    backend
      .expectOne(CREATE)
      .flush({ errorCode: 4137, message: 'Не заполнены разделы' }, { status: 400, statusText: 'Bad Request' });

    expect(service.profileHint()).toBe(5);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('отказ 4091 или 4102 — страница перечитывает конкурсы', () => {
    const stale = vi.fn();

    service.stale.subscribe(stale);

    for (const errorCode of [4091, 4102]) {
      service.apply({ id: 5 });
      passBanCheck();
      backend.expectOne(PROFILE).flush({});
      backend.expectOne(CREATE).flush({ errorCode, message: 'Отказ' }, { status: 409, statusText: 'Conflict' });
    }

    expect(stale).toHaveBeenCalledTimes(2);
    expect(service.profileHint()).toBeNull();
  });

  it('отказ 4102 запоминает тип конкурса: мешающая заявка может быть не видна фронту', () => {
    service.apply({ id: 5, type: 'RESERVE' });
    passBanCheck();
    backend.expectOne(PROFILE).flush({});
    backend
      .expectOne(CREATE)
      .flush({ errorCode: 4102, message: 'Есть активная заявка' }, { status: 409, statusText: 'Conflict' });

    expect([...service.refusedTypes()]).toEqual(['RESERVE']);

    service.apply({ id: 5, type: 'SUPREME_COURT' });
    passBanCheck();
    backend.expectOne(PROFILE).flush({});
    backend.expectOne(CREATE).flush({ errorCode: 4091, message: 'Уже есть' }, { status: 409, statusText: 'Conflict' });

    expect([...service.refusedTypes()]).toEqual(['RESERVE']);
  });

  it('отказ 4153 — статус отстранения перечитывается', () => {
    service.apply({ id: 5 });
    passBanCheck();
    backend.expectOne(PROFILE).flush({});
    backend.expectOne(CREATE).flush({ errorCode: 4153, message: 'Отстранён' }, { status: 409, statusText: 'Conflict' });
    backend.expectOne(BAN).flush({ banned: true, bannedUntil: '2027-01-01' });

    expect(service.banned()).toBe(true);
  });
});
