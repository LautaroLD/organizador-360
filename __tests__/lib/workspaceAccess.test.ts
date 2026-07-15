import { isMissingWorkspaceRelation } from '@/lib/workspaceAccess';

describe('workspaceAccess', () => {
  it('detecta tablas de workspace ausentes', () => {
    expect(isMissingWorkspaceRelation({ code: '42P01', message: 'relation does not exist' })).toBe(
      true,
    );
    expect(
      isMissingWorkspaceRelation({
        code: 'PGRST205',
        message: 'Could not find the table in the schema cache',
      }),
    ).toBe(true);
    expect(isMissingWorkspaceRelation({ code: '42501', message: 'permission denied' })).toBe(
      false,
    );
    expect(isMissingWorkspaceRelation(null)).toBe(false);
  });
});
