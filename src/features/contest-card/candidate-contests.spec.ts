import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { Schemas } from '@domain/api/api.types';
import { SKIP_ERROR_TOAST } from '@shared/api/http-context';

import { type CandidateContests, CandidateContestsLoader } from './candidate-contests';
import { hasActiveInSameType, UNKNOWN_TYPE } from './contest-action';

const AVAILABLE = '/v1/contest/available';
const MY = '/v1/contest-application/my';

function page<T>(content: T[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1, last: true };
}

describe('CandidateContestsLoader', () => {
  let loader: CandidateContestsLoader;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });

    loader = TestBed.inject(CandidateContestsLoader);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function load(): { result: () => CandidateContests | undefined } {
    let result: CandidateContests | undefined;

    loader.load().subscribe((value) => (result = value));

    return { result: () => result };
  }

  function respond(options: {
    cards?: Schemas['ContestCardResponse'][] | 'error';
    applications?: Schemas['ApplicationResponse'][] | 'error';
  }): void {
    const error = { errorCode: 5000, message: 'Сбой' };
    const failure = { status: 500, statusText: 'Server Error' };
    const available = backend.expectOne((request) => request.url === AVAILABLE);
    const my = backend.expectOne((request) => request.url === MY);

    if (options.cards === 'error') available.flush(error, failure);
    else available.flush(page(options.cards ?? []));

    if (options.applications === 'error') my.flush(error, failure);
    else my.flush(page(options.applications ?? []));
  }

  it('тип конкурса вне /available (отменённого) догружается: заявка блокирует только свой тип', () => {
    const { result } = load();

    respond({
      cards: [{ id: 2, type: 'RESERVE' }],
      applications: [
        { id: 10, contestId: 7, status: 'PENDING_SECRETARY_REVIEW' },
        { id: 11, contestId: 8, status: 'WITHDRAWN_BY_CANDIDATE' },
      ],
    });

    const contest = backend.expectOne('/v1/contest/7');

    expect(contest.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    contest.flush({ id: 7, type: 'RESERVE', status: 'CANCELLED' });

    const participation = result()!.participation!;

    expect(participation.activeTypes.get(7)).toBe('RESERVE');
    expect(hasActiveInSameType({ id: 2, type: 'RESERVE' }, participation)).toBe(true);
    expect(hasActiveInSameType({ id: 3, type: 'SUPREME_COURT' }, participation)).toBe(false);
  });

  it('тип узнать не удалось — заявка блокирует все типы', () => {
    const { result } = load();

    respond({ cards: [], applications: [{ id: 10, contestId: 7, status: 'NEW' }] });
    backend.expectOne('/v1/contest/7').flush(null, { status: 500, statusText: 'Server Error' });

    expect(result()!.participation!.activeTypes.get(7)).toBe(UNKNOWN_TYPE);
  });

  it('ошибка /available не теряет заявки кандидата', () => {
    const { result } = load();

    respond({ cards: 'error', applications: [{ id: 10, contestId: 5, status: 'NEW' }] });
    backend.expectOne('/v1/contest/5').flush({ id: 5, type: 'RESERVE' });

    expect(result()!.cards).toBeNull();
    expect(result()!.participation!.applicationIds.get(5)).toBe(10);
  });

  it('ошибка /my — список конкурсов без заявок', () => {
    const { result } = load();

    respond({ cards: [{ id: 2, type: 'RESERVE' }], applications: 'error' });

    expect(result()).toEqual({ cards: [{ id: 2, type: 'RESERVE' }], participation: null });
  });
});
