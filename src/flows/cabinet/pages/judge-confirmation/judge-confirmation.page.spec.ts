import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LangService } from '@reforgium/presentia';
import { type Confirmation as ConfirmOptions, ConfirmationService } from 'primeng/api';
import { EMPTY } from 'rxjs';

import { SseService } from '@shared/api/sse.service';
import { NotifyService } from '@shared/ui/notify.service';

import type { Confirmation } from './judge-confirmation.logic';
import JudgeConfirmationPage from './judge-confirmation.page';

const BASE = '/v1/active-judge-confirmations';

const DRAFT: Confirmation = {
  id: 7,
  status: 'CREATED',
  courtId: 3,
  courtName: 'Бишкекский городской суд',
  workExperienceFrom: '2015-03-01',
  workExperienceTo: '2024-12-31',
  decreeFileId: 11,
  assignmentFileId: 12,
  qualificationFileId: 13,
};

describe('JudgeConfirmationPage', () => {
  let backend: HttpTestingController;
  let confirm: { confirm: ReturnType<typeof vi.fn> };
  let notify: { success: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    notify = { success: vi.fn() };
    // Диалог подтверждения сразу «нажимает» «Отправить».
    confirm = {
      confirm: vi.fn((options: ConfirmOptions) => {
        (options.accept as (() => void) | undefined)?.();
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
        { provide: SseService, useValue: { on: () => EMPTY } },
        { provide: NotifyService, useValue: notify },
        { provide: ConfirmationService, useValue: confirm },
      ],
    });

    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Справочник судов и метаданные файлов — побочные запросы дочерних компонентов.
    backend.match((request) => request.url.startsWith('/v1/file/'));
    backend.verify();
  });

  function flushCourts(): void {
    backend
      .match('/v1/directory/COURT_NAME/all')
      .forEach((request) => request.flush([{ id: 3, nameRu: 'Бишкекский городской суд', active: true }]));
  }

  async function open(latest: Confirmation | null, history: Confirmation[] = []) {
    const fixture = TestBed.createComponent(JudgeConfirmationPage);

    await fixture.whenStable();
    respond(latest, history);
    await fixture.whenStable();
    flushCourts();
    await fixture.whenStable();

    return fixture;
  }

  function respond(latest: Confirmation | null, history: Confirmation[] = []): void {
    const request = backend.expectOne(`${BASE}/my/latest`);

    if (latest) request.flush(latest);
    else request.flush({ errorCode: 44430, message: 'not found' }, { status: 404, statusText: 'Not Found' });

    backend.expectOne(`${BASE}/my/history`).flush(history);
  }

  function text(fixture: ComponentFixture<JudgeConfirmationPage>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(fixture: ComponentFixture<JudgeConfirmationPage>, key: string): HTMLButtonElement | undefined {
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    return buttons.find((item) => item.textContent?.includes(key));
  }

  it('shows the intro and an empty form when there is no request yet (404)', async () => {
    const fixture = await open(null);

    expect(text(fixture)).toContain('judge-confirmation.intro.title');
    expect(text(fixture)).toContain('judge-confirmation.form.title-new');
    expect(button(fixture, 'judge-confirmation.form.submit')).toBeDefined();
    expect(text(fixture)).not.toContain('judge-confirmation.history.title');
  });

  it('does not submit an incomplete form and marks missing documents', async () => {
    const fixture = await open(null);

    button(fixture, 'judge-confirmation.form.submit')!.click();
    await fixture.whenStable();

    expect(confirm.confirm).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('judge-confirmation.form.file-required');
  });

  it('saves the CREATED draft and submits it after confirmation', async () => {
    const fixture = await open(DRAFT, [DRAFT]);

    expect(text(fixture)).toContain('judge-confirmation.form.title-draft');

    button(fixture, 'judge-confirmation.form.submit')!.click();
    await fixture.whenStable();

    expect(confirm.confirm).toHaveBeenCalledTimes(1);

    const save = backend.expectOne({ method: 'POST', url: BASE });

    expect(save.request.body).toEqual({
      courtId: 3,
      courtName: 'Бишкекский городской суд',
      workExperienceFrom: '2015-03-01',
      workExperienceTo: '2024-12-31',
      decreeFileId: 11,
      assignmentFileId: 12,
      qualificationFileId: 13,
    });
    save.flush(DRAFT);

    const pending = { ...DRAFT, status: 'PENDING_SECRETARY_REVIEW' as const, submittedAt: '2026-09-28T10:00:00' };

    backend.expectOne({ method: 'POST', url: `${BASE}/7/submit` }).flush(pending);
    expect(notify.success).toHaveBeenCalledWith('judge-confirmation.toast.submitted');

    respond(pending, [pending]);
    await fixture.whenStable();

    expect(text(fixture)).toContain('judge-confirmation.state.pending');
    expect(button(fixture, 'judge-confirmation.form.submit')).toBeUndefined();
  });

  it('is read-only while the secretary reviews the request', async () => {
    const fixture = await open({ ...DRAFT, status: 'UNDER_REVIEW' });

    expect(text(fixture)).toContain('judge-confirmation.state.pending');
    expect(button(fixture, 'judge-confirmation.form.save')).toBeUndefined();
    expect(button(fixture, 'judge-confirmation.state.new')).toBeUndefined();
  });

  it('shows the reject reason and lets the user start a new request', async () => {
    const rejected = { ...DRAFT, status: 'REJECTED' as const, rejectReason: 'Нет указа о направлении' };
    const fixture = await open(rejected, [rejected]);

    expect(text(fixture)).toContain('Нет указа о направлении');
    expect(text(fixture)).toContain('judge-confirmation.history.title');

    button(fixture, 'judge-confirmation.state.new')!.click();
    await fixture.whenStable();

    expect(text(fixture)).toContain('judge-confirmation.form.title-new');
    expect(button(fixture, 'shell.actions.cancel')).toBeDefined();
  });

  it('asks to sign in again after approval while the token has no ACTIVE_JUDGE role', async () => {
    const fixture = await open({ ...DRAFT, status: 'APPROVED', decidedAt: '2026-09-28T12:00:00' });

    expect(text(fixture)).toContain('judge-confirmation.state.approved');
    expect(button(fixture, 'judge-confirmation.state.relogin-action')).toBeDefined();
    expect(button(fixture, 'judge-confirmation.state.repeat')).toBeDefined();
  });
});
