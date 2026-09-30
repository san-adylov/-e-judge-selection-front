import { DRAFT_DEBOUNCE_MS, draftKey, parseDraft, serializeDraft } from './essay.logic';
import { DraftBackup, safeSessionStorage } from './essay-draft';

/** Хранилище в памяти; `fail` — имитация переполнения квоты или запрета записи. */
class MemoryStorage implements Storage {
  readonly items = new Map<string, string>();
  fail = false;
  writes = 0;

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.fail) throw new DOMException('Quota exceeded', 'QuotaExceededError');

    this.writes++;
    this.items.set(key, value);
  }
}

describe('DraftBackup', () => {
  let storage: MemoryStorage;
  let backup: DraftBackup;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T04:00:00Z'));
    storage = new MemoryStorage();
    backup = new DraftBackup(storage);
  });

  afterEach(() => vi.useRealTimers());

  it('восстанавливает черновик своей работы и время его записи', () => {
    storage.setItem(draftKey(7), serializeDraft(['первый', 'второй'], 1234));
    storage.setItem(draftKey(8), serializeDraft(['чужой'], 99));

    expect(backup.open(7)).toEqual({ v: 1, answers: ['первый', 'второй'], savedAt: 1234 });
    expect(backup.savedAt()).toBe(1234);
    expect(backup.open(9)).toBeNull();
    expect(backup.savedAt()).toBeNull();
  });

  it('битый черновик — как отсутствие черновика', () => {
    storage.setItem(draftKey(7), '{"answers":');

    expect(backup.open(7)).toBeNull();
  });

  it('откладывает запись на паузу ввода и пишет последний текст одной записью', () => {
    let answers = ['а'];

    backup.open(7);
    backup.schedule(() => answers);
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS - 1);
    answers = ['аб'];
    backup.schedule(() => answers);
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS - 1);

    expect(storage.writes).toBe(0);

    answers = ['абв'];
    vi.advanceTimersByTime(1);

    expect(storage.writes).toBe(1);
    expect(parseDraft(storage.getItem(draftKey(7)))?.answers).toEqual(['абв']);
    expect(backup.savedAt()).toBe(Date.now());
  });

  it('flush пишет сразу и отменяет отложенную запись', () => {
    backup.open(7);
    backup.schedule(() => ['текст']);
    backup.flush();

    expect(storage.writes).toBe(1);

    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2);
    backup.flush();

    expect(storage.writes).toBe(1);
  });

  it('ошибка записи поднимает флаг, следующая удачная запись его снимает', () => {
    backup.open(7);
    storage.fail = true;
    backup.write(['текст']);

    expect(backup.failed()).toBe(true);
    expect(backup.savedAt()).toBeNull();

    storage.fail = false;
    backup.write(['текст']);

    expect(backup.failed()).toBe(false);
    expect(backup.savedAt()).toBe(Date.now());
  });

  it('без sessionStorage — флаг ошибки, без исключений', () => {
    const detached = new DraftBackup(null);

    expect(detached.open(7)).toBeNull();

    detached.write(['текст']);

    expect(detached.failed()).toBe(true);
  });

  it('до open ничего не пишет', () => {
    backup.write(['текст']);

    expect(storage.writes).toBe(0);
  });

  it('remove удаляет черновик и отменяет отложенную запись', () => {
    backup.open(7);
    backup.write(['текст']);
    backup.schedule(() => ['ещё']);
    backup.remove();
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS);

    expect(storage.getItem(draftKey(7))).toBeNull();
    expect(backup.savedAt()).toBeNull();
  });

  it('safeSessionStorage не падает, если доступ к хранилищу запрещён', () => {
    const blocked = Object.defineProperty({}, 'sessionStorage', {
      get: () => {
        throw new DOMException('Denied', 'SecurityError');
      },
    }) as Window;

    expect(safeSessionStorage(blocked)).toBeNull();
    expect(safeSessionStorage(null)).toBeNull();
  });
});
