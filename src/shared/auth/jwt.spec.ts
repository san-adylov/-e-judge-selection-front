import { fakeJwt } from '../../testing/tokens';
import { decodeJwtPayload, stageExerciseOf } from './jwt';

describe('jwt', () => {
  it('decodes a base64url payload with Cyrillic text', () => {
    expect(decodeJwtPayload(fakeJwt({ fullName: 'Жумабекова Айгүл', lang: 'KG' }))).toEqual({
      fullName: 'Жумабекова Айгүл',
      lang: 'KG',
    });
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('a.%%%.c')).toBeNull();
  });

  it('reads the stage exercise only from stage tokens', () => {
    expect(stageExerciseOf(fakeJwt({ exerciseId: 12, exerciseType: 'TEST' }))).toEqual({
      exerciseId: 12,
      exerciseType: 'TEST',
    });
    expect(stageExerciseOf(fakeJwt({ roles: ['CANDIDATE'] }))).toBeNull();
    expect(stageExerciseOf(fakeJwt({ exerciseId: 12, exerciseType: 'QUIZ' }))).toBeNull();
  });
});
