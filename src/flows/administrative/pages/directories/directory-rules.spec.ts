import { describe, expect, it } from 'vitest';

import { ALL_DIRECTORY_CODES, isEditable, isExternal, PARENT_CODE } from './directory-rules';

describe('directory-rules', () => {
  it('внешние справочники не редактируются вручную', () => {
    expect(isExternal('COUNTRY')).toBe(true);
    expect(isEditable('COUNTRY')).toBe(false);
    expect(isExternal('DOCUMENT_TYPE')).toBe(false);
    expect(isEditable('DOCUMENT_TYPE')).toBe(true);
  });

  it('родитель иерархических кодов известен', () => {
    expect(PARENT_CODE.DISTRICT).toBe('REGION');
    expect(PARENT_CODE.STREET).toBe('CITY');
    expect(PARENT_CODE.COUNTRY).toBeUndefined();
  });

  it('все коды перечислены', () => {
    expect(ALL_DIRECTORY_CODES).toContain('WORK_EXPERIENCE_REQUIREMENT');
    expect(ALL_DIRECTORY_CODES.length).toBe(24);
  });
});
