import { describe, expect, it } from 'vitest';

import { AUDIT_ACTION_TYPES, AUDIT_ENTITY_TYPES, normalizeEventType } from './audit-rules';

describe('audit-rules', () => {
  it('списки enum совпадают с бэкендом по размеру', () => {
    expect(AUDIT_ENTITY_TYPES.length).toBe(29);
    expect(AUDIT_ACTION_TYPES.length).toBe(12);
  });

  it('код события нормализуется к имени enum', () => {
    expect(normalizeEventType(' application submit ')).toBe('APPLICATION_SUBMIT');
    expect(normalizeEventType('vote-cast')).toBe('VOTE_CAST');
    expect(normalizeEventType('')).toBeUndefined();
    expect(normalizeEventType('1bad')).toBeUndefined();
  });
});
