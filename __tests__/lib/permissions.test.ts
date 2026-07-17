import {
  getDefaultPermissions,
  hasPermission,
  normalizeProjectRole,
  resolvePermissions,
} from '@/lib/permissions';

describe('permissions', () => {
  it('normaliza roles PascalCase y aliases', () => {
    expect(normalizeProjectRole('Owner')).toBe('Owner');
    expect(normalizeProjectRole('admin')).toBe('Admin');
    expect(normalizeProjectRole('member')).toBe('Collaborator');
    expect(normalizeProjectRole('Viewer')).toBe('Viewer');
    expect(normalizeProjectRole('unknown')).toBeNull();
  });

  it('da acceso completo a Owner y Admin', () => {
    expect(hasPermission('Owner', 'export.data')).toBe(true);
    expect(hasPermission('Admin', 'members.manage')).toBe(true);
    expect(hasPermission('Admin', 'audit.view')).toBe(true);
  });

  it('da write modules a Collaborator y nada a Viewer por defecto', () => {
    expect(hasPermission('Collaborator', 'kanban.edit')).toBe(true);
    expect(hasPermission('Collaborator', 'members.invite')).toBe(false);
    expect(hasPermission('Viewer', 'chat.write')).toBe(false);
    expect(getDefaultPermissions('Viewer').size).toBe(0);
  });

  it('aplica overrides solo a roles limitados', () => {
    const withInvite = resolvePermissions('Collaborator', [
      { permission: 'members.invite', granted: true },
    ]);
    expect(withInvite.has('members.invite')).toBe(true);

    const deniedKanban = resolvePermissions('Collaborator', [
      { permission: 'kanban.edit', granted: false },
    ]);
    expect(deniedKanban.has('kanban.edit')).toBe(false);

    const adminWithDeny = resolvePermissions('Admin', [
      { permission: 'kanban.edit', granted: false },
    ]);
    expect(adminWithDeny.has('kanban.edit')).toBe(true);

    const viewerGranted = resolvePermissions('Viewer', [
      { permission: 'resources.upload', granted: true },
    ]);
    expect(viewerGranted.has('resources.upload')).toBe(true);
  });

  it('niega permiso de Collaborator y otorga invite a Viewer', () => {
    expect(
      hasPermission('Collaborator', 'chat.write', [
        { permission: 'chat.write', granted: false },
      ]),
    ).toBe(false);

    expect(
      hasPermission('Viewer', 'members.invite', [
        { permission: 'members.invite', granted: true },
      ]),
    ).toBe(true);
  });
});
