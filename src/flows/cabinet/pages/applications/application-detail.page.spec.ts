import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import { LangService } from '@reforgium/presentia';
import { type Confirmation, ConfirmationService } from 'primeng/api';
import { Subject } from 'rxjs';

import type { ApplicationStatus, Schemas } from '@domain/api/api.types';
import { SKIP_ERROR_TOAST } from '@shared/api/http-context';
import { type SseEventMap, SseService } from '@shared/api/sse.service';
import { NotifyService } from '@shared/ui/notify.service';

import ApplicationDetailPage from './application-detail.page';

const BASE = '/v1/contest-application';

describe('ApplicationDetailPage', () => {
  let backend: HttpTestingController;
  let events: Subject<SseEventMap['applicationStatus']>;
  let notify: { success: ReturnType<typeof vi.fn> };
  let confirm: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    events = new Subject();
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
        {
          provide: LangService,
          useValue: {
            get: (key: string) => key,
            currentLang: () => 'ru',
            observe: (key: string) => () => key,
            isNamespaceLoaded: () => true,
          },
        },
        { provide: SseService, useValue: { on: () => events.asObservable() } },
        { provide: NotifyService, useValue: notify },
        { provide: ConfirmationService, useValue: confirm },
      ],
    });

    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function application(status: ApplicationStatus, extra: Partial<Schemas['ApplicationResponse']> = {}) {
    return { id: 7, contestId: 3, contestName: 'Конкурс на должность судьи', status, ...extra };
  }

  function respond(status: ApplicationStatus, extra: Partial<Schemas['ApplicationResponse']> = {}): void {
    backend.expectOne(`${BASE}/7`).flush(application(status, extra));
    backend.expectOne(`${BASE}/7/history`).flush([]);
  }

  async function open(
    status: ApplicationStatus,
    extra: Partial<Schemas['ApplicationResponse']> = {},
  ): Promise<ComponentFixture<ApplicationDetailPage>> {
    const fixture = TestBed.createComponent(ApplicationDetailPage);

    fixture.componentRef.setInput('id', '7');
    await fixture.whenStable();
    respond(status, extra);
    await fixture.whenStable();

    return fixture;
  }

  function button(fixture: ComponentFixture<ApplicationDetailPage>, key: string): HTMLButtonElement | undefined {
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    return buttons.find((item) => item.textContent?.includes(key));
  }

  it('черновик: доступны редактирование, отправка и отзыв, жалобы нет', async () => {
    const fixture = await open('NEW');

    expect(button(fixture, 'applications.actions.edit')).toBeTruthy();
    expect(button(fixture, 'applications.actions.submit')).toBeTruthy();
    expect(button(fixture, 'applications.actions.withdraw')).toBeTruthy();
    expect(button(fixture, 'applications.complaint.action')).toBeUndefined();
  });

  it('отправка на рассмотрение: подтверждение → POST → тост → перечитывание', async () => {
    const fixture = await open('RETURNED_FOR_CORRECTION', { returnReason: 'Нет копии диплома' });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Нет копии диплома');

    button(fixture, 'applications.actions.submit')!.click();

    expect(confirm.confirm).toHaveBeenCalledOnce();

    const request = backend.expectOne(`${BASE}/send-for-review/7`);

    expect(request.request.method).toBe('POST');
    request.flush(application('PENDING_SECRETARY_REVIEW'));

    expect(notify.success).toHaveBeenCalledWith('applications.toast.submitted');

    respond('PENDING_SECRETARY_REVIEW');
    await fixture.whenStable();

    expect(button(fixture, 'applications.actions.submit')).toBeUndefined();
    expect(button(fixture, 'applications.actions.withdraw')).toBeTruthy();
  });

  it('отзыв на рассмотрении Совета: только кнопка отзыва, POST withdraw и перечитывание', async () => {
    const fixture = await open('PENDING_BOARD_REVIEW');

    expect(button(fixture, 'applications.actions.edit')).toBeUndefined();
    expect(button(fixture, 'applications.actions.submit')).toBeUndefined();

    button(fixture, 'applications.actions.withdraw')!.click();

    const request = backend.expectOne(`${BASE}/withdraw/7`);

    expect(request.request.method).toBe('POST');
    request.flush(application('WITHDRAWN_BY_CANDIDATE'));

    expect(notify.success).toHaveBeenCalledWith('applications.toast.withdrawn');

    respond('WITHDRAWN_BY_CANDIDATE');
    await fixture.whenStable();

    expect(button(fixture, 'applications.actions.withdraw')).toBeUndefined();
  });

  it('отклонена Советом: ссылка на жалобу по этапу документов', async () => {
    const fixture = await open('REJECTED_BY_BOARD');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    expect(button(fixture, 'applications.actions.withdraw')).toBeUndefined();

    button(fixture, 'applications.complaint.action')!.click();

    const target = navigate.mock.calls[0]?.[0] as UrlTree;

    expect(router.serializeUrl(target)).toBe('/cabinet/complaints?applicationId=7&type=DOCUMENT_STAGE');
  });

  it('недоступная заявка: сообщение на странице вместо тоста', async () => {
    const fixture = TestBed.createComponent(ApplicationDetailPage);

    fixture.componentRef.setInput('id', '7');
    await fixture.whenStable();

    const request = backend.expectOne(`${BASE}/7`);

    expect(request.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    request.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    // История отменена вместе с forkJoin.
    backend.match(`${BASE}/7/history`);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('applications.detail.not-found');
  });

  it('событие SSE по этой заявке перечитывает её, по чужой — нет', async () => {
    const fixture = await open('PENDING_SECRETARY_REVIEW');

    events.next({ applicationId: 8, status: 'PENDING_BOARD_REVIEW' });
    backend.expectNone(`${BASE}/7`);

    events.next({ applicationId: 7, status: 'PENDING_BOARD_REVIEW' });
    respond('PENDING_BOARD_REVIEW');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('applications.hint.PENDING_BOARD_REVIEW');
  });
});
