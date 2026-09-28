import { ACCESS_GROUPS, type AccessGroup, hasAccess, type Role, ROLES } from './access-groups';

describe('access groups', () => {
  /** Ожидаемая матрица — из `AccessGroups.java` бэкенда v2. */
  const expected: Record<Exclude<AccessGroup, 'AUTHENTICATED'>, Role[]> = {
    ADMIN: ['SUPER_ADMIN', 'ADMIN'],
    SUPER_ADMIN: ['SUPER_ADMIN'],
    CHAIRMAN: ['CHAIRMAN', 'VICE_CHAIRMAN'],
    BOARD: ['CHAIRMAN', 'VICE_CHAIRMAN', 'BOARD_MEMBER'],
    SECRETARY: ['SECRETARY'],
    COUNCIL: ['CHAIRMAN', 'VICE_CHAIRMAN', 'BOARD_MEMBER', 'SECRETARY'],
    STAFF: ['SUPER_ADMIN', 'ADMIN', 'CHAIRMAN', 'VICE_CHAIRMAN', 'BOARD_MEMBER', 'SECRETARY'],
    CANDIDATE: ['CANDIDATE', 'ACTIVE_JUDGE'],
    ACTIVE_JUDGE: ['ACTIVE_JUDGE'],
  };

  it('matches the backend groups exactly', () => {
    expect(ACCESS_GROUPS).toEqual(expected);
  });

  for (const [group, roles] of Object.entries(expected) as [keyof typeof expected, Role[]][]) {
    it(`grants ${group} only to its roles`, () => {
      for (const role of ROLES) {
        expect(hasAccess([role], group)).toBe(roles.includes(role));
      }
    });
  }

  it('checks every role of a multi-role user', () => {
    expect(hasAccess(['CANDIDATE', 'SECRETARY'], 'STAFF')).toBe(true);
    expect(hasAccess(['CANDIDATE', 'SECRETARY'], 'CANDIDATE')).toBe(true);
    expect(hasAccess(['CANDIDATE', 'SECRETARY'], 'BOARD')).toBe(false);
  });

  it('treats a list of groups as "any of"', () => {
    expect(hasAccess(['SECRETARY'], ['CHAIRMAN', 'SECRETARY'])).toBe(true);
    expect(hasAccess(['BOARD_MEMBER'], ['CHAIRMAN', 'SECRETARY'])).toBe(false);
  });

  it('allows AUTHENTICATED for any signed-in user and nothing for anonymous', () => {
    expect(hasAccess([], 'AUTHENTICATED')).toBe(true);
    expect(hasAccess(null, 'AUTHENTICATED')).toBe(false);
    expect(hasAccess(null, 'CANDIDATE')).toBe(false);
  });
});
