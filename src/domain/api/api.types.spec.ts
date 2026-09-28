import { toParams } from './api.types';

describe('toParams', () => {
  it('drops empty values and repeats array parameters', () => {
    const params = toParams({ contestId: 5, status: ['NEW', 'PENDING_BOARD_REVIEW'], search: '', parentId: null });

    expect(params.toString()).toBe('contestId=5&status=NEW&status=PENDING_BOARD_REVIEW');
  });

  it('keeps false and zero', () => {
    expect(toParams({ page: 0, activeOnly: false }).toString()).toBe('page=0&activeOnly=false');
  });
});
