import { formatAuditAction } from '@/lib/auditLog';

describe('auditLog', () => {
  it('formatea acciones conocidas y deja pasar desconocidas', () => {
    expect(formatAuditAction('member.invite')).toBe('Invitación enviada');
    expect(formatAuditAction('approval.resolve')).toBe('Revisión resuelta');
    expect(formatAuditAction('custom.action')).toBe('custom.action');
  });
});
